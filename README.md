# Sistem QR/NFC Google Review Management

Implementasi MVP (prioritas P0) sesuai PRD, dibangun dengan Next.js 14
(App Router) + TypeScript + Supabase, siap deploy ke Vercel.

## Yang sudah diimplementasikan (P0)

- Public route `/{public_code}`: redirect otomatis jika kartu ACTIVE,
  halaman aktivasi jika UNINITIALIZED, halaman "tidak aktif" jika DISABLED.
- Aktivasi kartu: verifikasi PIN → pemilik bisnis tempel link share
  Google Maps miliknya sendiri → sistem membaca CID dari link tersebut
  → konfirmasi → aktivasi atomik (anti race-condition). **Tidak
  memakai Google Places API**, jadi tidak perlu akun Google Cloud /
  kartu billing sama sekali.
- PIN di-hash dengan bcrypt (via `pgcrypto` langsung di Postgres),
  tidak pernah plaintext di database.
- Brute-force protection per-kartu: rate limit + lockout progresif,
  dicatat di tabel `card_security`. Ditambah rate limit per-IP di layer
  API (lihat catatan production di bawah).
- Halaman `/manage`: pemegang kartu masuk dengan kode + PIN, melihat
  status, dan mereset kartu.
- Dashboard admin (`/admin/dashboard`, dilindungi Supabase Auth):
  generate kartu massal, lihat & filter semua kartu, nonaktifkan/aktifkan,
  reset kartu, reset PIN, export CSV.
- Audit log untuk semua tindakan sensitif (`audit_logs`).
- Row Level Security aktif di semua tabel; akses data hanya lewat
  service role key di server (Route Handlers), tidak pernah dari browser.
- Validasi target redirect harus berasal dari domain Google (anti
  open-redirect).
- Mobile-first UI, mengikuti referensi (kartu putih rounded, tombol biru).
- Generate gambar QR (PNG) per kartu, satuan maupun langsung dari hasil
  batch generate (tombol "QR" di dashboard).

**Belum termasuk (P1/P2 lain, sesuai PRD)**: NFC payload writer,
analytics, multi-tenant/reseller, billing. Struktur database sudah
menyiapkan ruang untuk sebagian ini.

## 1. Setup Supabase

1. Buat project baru di [supabase.com](https://supabase.com) — buat **dua**
   project terpisah: satu untuk development, satu untuk production
   (sesuai Definition of Done pada PRD).
2. Buka **SQL Editor**, jalankan seluruh isi `supabase/schema.sql`.
3. Buat akun admin pertama:
   - Buka **Authentication > Users > Add user**, buat user dengan email + password.
   - Di **SQL Editor**, jalankan:
     ```sql
     insert into public.profiles (id, role, name, is_active)
     values ('UUID_USER_TADI', 'SUPER_ADMIN', 'Nama Admin', true);
     ```
4. Ambil kredensial di **Project Settings > API**:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL` dan `SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (rahasia, jangan
     pernah expose ke client atau commit ke git)

## 2. Cara kerja pengambilan link Google Maps (tanpa Google Cloud)

Tidak ada setup tambahan di langkah ini — tidak butuh akun Google Cloud
atau API key apapun. Saat aktivasi, pemilik bisnis:

1. Buka Google Maps, cari bisnisnya sendiri.
2. Tap tombol **Share / Bagikan** → **Copy link**.
3. Tempel link itu ke form aktivasi kartu.

Server (`lib/google-maps-link.ts`) akan mengikuti redirect jika link
berupa short link, lalu mengekstrak **CID** (Customer/Place ID numerik)
yang ada di dalam URL Google Maps, dan menyusun link "Tulis Review"
langsung darinya. Teknik ini memanfaatkan pola URL yang konsisten dari
Google, tapi **tidak resmi didokumentasikan** — kalau suatu saat Google
mengubah format URL-nya, ekstraksi ini bisa perlu disesuaikan (lihat
komentar di `lib/google-maps-link.ts`).

Kalau di kemudian hari ingin beralih ke Google Places API resmi
(butuh Google Cloud + billing aktif), struktur kode sudah dipisah rapi
di modul ini sehingga tinggal diganti tanpa menyentuh bagian lain.

## 3. Menjalankan secara lokal

```bash
npm install
cp .env.example .env.local
# isi semua nilai di .env.local

npm run dev
```

Buka `http://localhost:3000`.

## 4. Deploy ke Vercel

1. Push project ini ke repository Git (GitHub/GitLab).
2. Import project di [vercel.com](https://vercel.com).
3. Di **Settings > Environment Variables**, masukkan semua variabel dari
   `.env.example` — gunakan environment terpisah untuk Preview dan
   Production, mengarah ke project Supabase yang berbeda.
4. Set `NEXT_PUBLIC_SITE_URL` ke domain production (mis.
   `https://review-gmaps.vercel.app`) — dipakai untuk menyusun URL QR
   saat export.
5. Deploy.

## 5. Alur pemakaian singkat

- **Admin generate kartu**: login di `/admin/login` → dashboard → isi
  jumlah kartu → Generate. PIN awal setiap kartu **hanya ditampilkan
  sekali** saat itu — download CSV-nya untuk keperluan cetak kartu.
- **Cetak QR**: klik tombol "QR" di baris kartu (dashboard) atau di hasil
  batch generate untuk mengunduh PNG siap cetak. Bisa juga pakai kolom
  `qr_url` pada CSV export dengan tool QR pilihan Anda sendiri.
- **Pelanggan/kartu baru**: scan → `/{kode}` → masukkan PIN → tempel
  link Google Maps bisnis → konfirmasi → aktif.
- **Reset**: lewat `/manage` (pemegang kartu) atau dashboard admin.

## 6. Catatan penting sebelum production

1. **Rate limiting per-IP**: `lib/rate-limit.ts` memakai in-memory map
   sebagai baseline. Ini **tidak cukup** untuk Vercel serverless
   (multi-instance). Untuk production, ganti dengan
   [Upstash Ratelimit](https://github.com/upstash/ratelimit) (Redis) —
   tinggal ganti isi fungsi `checkRateLimit`, pemanggilnya di API routes
   tidak perlu berubah.
2. **RLS**: sudah aktif dan default-deny untuk tabel sensitif karena
   semua akses lewat `service_role` key di server. Tetap lakukan
   pengujian RLS (AC-018) sebelum go-live, terutama jika nanti ada
   penambahan akses langsung dari client ke Supabase Data API.
3. **Session management**: management session berumur 15 menit
   (`lib/session.ts`), disimpan sebagai hash token + cookie httpOnly.
   Reset kartu otomatis menaikkan `pin_version` sehingga semua sesi lama
   langsung tidak valid.
4. **Backup & monitoring**: aktifkan Point-in-Time Recovery di Supabase
   dan hubungkan error tracking (mis. Sentry) sebelum production, sesuai
   Definition of Done pada PRD.

## Struktur folder

```
app/
  [code]/            # halaman publik: redirect / aktivasi
  manage/            # halaman pemegang kartu
  admin/
    login/
    dashboard/
  api/
    cards/[code]/    # verify-pin, resolve-link, activate, reset, status
    admin/           # generate, cards (list+aksi), export
lib/
  supabase/            # client admin (service role), server (auth), browser
  session.ts           # management session
  google-maps-link.ts  # ekstraksi CID dari link Google Maps (tanpa API)
  validators.ts        # skema zod
  audit.ts, rate-limit.ts, require-admin.ts
supabase/
  schema.sql         # tabel, RLS, function RPC atomik
```
