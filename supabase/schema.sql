-- ============================================================
-- QR/NFC Google Review Management — Supabase Schema
-- ============================================================
-- Jalankan file ini di Supabase SQL Editor (project production
-- dan development harus terpisah — jalankan di keduanya).

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- ENUM
-- ------------------------------------------------------------
do $$ begin
  create type card_status as enum ('UNINITIALIZED', 'ACTIVE', 'DISABLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type admin_role as enum ('ADMIN', 'SUPER_ADMIN');
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------
-- TABLES
-- ------------------------------------------------------------

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  public_code text unique not null,
  status card_status not null default 'UNINITIALIZED',
  pin_hash text not null,
  pin_version int not null default 1,
  business_id text,
  business_name text,
  business_address text,
  google_review_url text,
  google_maps_url text,
  activated_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists idx_cards_public_code on public.cards (public_code);
create index if not exists idx_cards_status on public.cards (status);

create table if not exists public.card_security (
  card_id uuid primary key references public.cards(id) on delete cascade,
  failed_pin_attempts int not null default 0,
  locked_until timestamptz,
  last_failed_at timestamptz,
  last_success_at timestamptz
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role admin_role not null default 'ADMIN',
  name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id),
  card_id uuid references public.cards(id) on delete set null,
  action text not null,
  success boolean not null,
  ip_hash text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_card on public.audit_logs (card_id);
create index if not exists idx_audit_created on public.audit_logs (created_at desc);

create table if not exists public.management_sessions (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  token_hash text not null,
  pin_version int not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists idx_mgmt_sessions_card on public.management_sessions (card_id);
create index if not exists idx_mgmt_sessions_token on public.management_sessions (token_hash);

create table if not exists public.google_places_cache (
  place_id text primary key,
  display_name text,
  formatted_address text,
  google_maps_url text,
  write_review_url text,
  cached_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ------------------------------------------------------------
-- Prinsip: SEMUA akses sensitif lewat server menggunakan
-- service_role key (bypass RLS by design di Supabase).
-- RLS di bawah ini adalah lapisan pertahanan kedua jika Data API
-- (anon/authenticated key) pernah dipakai langsung dari client.

alter table public.cards enable row level security;
alter table public.card_security enable row level security;
alter table public.profiles enable row level security;
alter table public.audit_logs enable row level security;
alter table public.management_sessions enable row level security;
alter table public.google_places_cache enable row level security;

-- Tidak ada policy untuk anon/authenticated di cards, card_security,
-- audit_logs, management_sessions -> default deny total dari Data API.
-- Semua akses WAJIB lewat Next.js API routes (service role key,
-- hanya berjalan di server).

-- profiles: admin boleh melihat profil miliknya sendiri saja
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

-- google_places_cache: read-only, tidak berisi data sensitif
create policy "places_cache_select_all" on public.google_places_cache
  for select using (true);

-- ------------------------------------------------------------
-- HELPER: cek apakah user saat ini adalah admin aktif
-- ------------------------------------------------------------
create or replace function public.is_active_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = uid and is_active = true
  );
$$;

-- ------------------------------------------------------------
-- RPC: generate_cards(count, admin_id)
-- Generate N kode unik + PIN awal (dikembalikan plaintext SEKALI
-- SAJA saat generate, untuk dicetak di kartu — setelah itu hanya
-- hash yang disimpan).
-- ------------------------------------------------------------
create or replace function public.rpc_generate_cards(p_count int, p_admin uuid)
returns table (id uuid, public_code text, pin text)
language plpgsql
security definer
set search_path = public
as $$
declare
  i int := 0;
  v_code text;
  v_pin text;
  v_id uuid;
begin
  if p_count < 1 or p_count > 500 then
    raise exception 'count must be between 1 and 500';
  end if;

  while i < p_count loop
    -- kode publik: 8 karakter base32-like, high entropy, tidak berurutan
    v_code := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 10));
    -- pastikan unik
    if exists (select 1 from public.cards where public_code = v_code) then
      continue;
    end if;

    -- PIN 6 digit numerik
    v_pin := lpad(floor(random() * 1000000)::text, 6, '0');

    insert into public.cards (public_code, status, pin_hash, created_by)
    values (v_code, 'UNINITIALIZED', crypt(v_pin, gen_salt('bf', 10)), p_admin)
    returning cards.id into v_id;

    insert into public.card_security (card_id) values (v_id);

    id := v_id;
    public_code := v_code;
    pin := v_pin;
    return next;

    i := i + 1;
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- RPC: verify PIN (atomik, dengan brute-force protection)
-- Mengembalikan card_id jika sukses; raise exception jika gagal
-- (kode/PIN salah, locked, atau kartu tidak valid).
-- ------------------------------------------------------------
create or replace function public.rpc_verify_pin(p_public_code text, p_pin text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card record;
  v_sec record;
  v_lock_minutes int;
begin
  select * into v_card from public.cards where public_code = p_public_code for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;

  if v_card.status = 'DISABLED' then
    raise exception 'DISABLED';
  end if;

  select * into v_sec from public.card_security where card_id = v_card.id for update;

  if v_sec.locked_until is not null and v_sec.locked_until > now() then
    raise exception 'LOCKED';
  end if;

  if crypt(p_pin, v_card.pin_hash) = v_card.pin_hash then
    update public.card_security
      set failed_pin_attempts = 0, locked_until = null, last_success_at = now()
      where card_id = v_card.id;
    return v_card.id;
  else
    v_lock_minutes := least(power(2, greatest(v_sec.failed_pin_attempts - 3, 0))::int, 60);
    update public.card_security
      set failed_pin_attempts = v_sec.failed_pin_attempts + 1,
          last_failed_at = now(),
          locked_until = case
            when v_sec.failed_pin_attempts + 1 >= 5
              then now() + (v_lock_minutes || ' minutes')::interval
            else locked_until
          end
      where card_id = v_card.id;
    raise exception 'INVALID_PIN';
  end if;
end;
$$;

-- ------------------------------------------------------------
-- RPC: aktivasi kartu secara atomik (mencegah race condition)
-- Hanya berhasil jika status masih UNINITIALIZED.
-- ------------------------------------------------------------
create or replace function public.rpc_activate_card(
  p_card_id uuid,
  p_business_id text,
  p_business_name text,
  p_business_address text,
  p_google_review_url text,
  p_google_maps_url text
) returns boolean
language sql
security definer
set search_path = public
as $$
  update public.cards
  set status = 'ACTIVE',
      business_id = p_business_id,
      business_name = p_business_name,
      business_address = p_business_address,
      google_review_url = p_google_review_url,
      google_maps_url = p_google_maps_url,
      activated_at = now(),
      updated_at = now()
  where id = p_card_id and status = 'UNINITIALIZED'
  returning true;
$$;

-- ------------------------------------------------------------
-- RPC: reset kartu (dipakai oleh pemegang kartu maupun admin)
-- ------------------------------------------------------------
create or replace function public.rpc_reset_card(p_card_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.cards
  set status = 'UNINITIALIZED',
      business_id = null,
      business_name = null,
      business_address = null,
      google_review_url = null,
      google_maps_url = null,
      activated_at = null,
      pin_version = pin_version + 1,
      updated_at = now()
  where id = p_card_id;

  update public.management_sessions
  set revoked_at = now()
  where card_id = p_card_id and revoked_at is null;
end;
$$;

-- ------------------------------------------------------------
-- RPC: admin reset PIN -> mengembalikan PIN baru (plaintext, sekali)
-- ------------------------------------------------------------
create or replace function public.rpc_admin_reset_pin(p_card_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pin text;
begin
  v_pin := lpad(floor(random() * 1000000)::text, 6, '0');

  update public.cards
  set pin_hash = crypt(v_pin, gen_salt('bf', 10)),
      pin_version = pin_version + 1,
      updated_at = now()
  where id = p_card_id;

  update public.card_security
  set failed_pin_attempts = 0, locked_until = null
  where card_id = p_card_id;

  update public.management_sessions
  set revoked_at = now()
  where card_id = p_card_id and revoked_at is null;

  return v_pin;
end;
$$;

comment on function public.rpc_generate_cards is 'Admin-only: dipanggil dari server dengan service role key.';
comment on function public.rpc_verify_pin is 'Dipanggil dari API publik dengan service role key setelah rate-limit per-IP.';
