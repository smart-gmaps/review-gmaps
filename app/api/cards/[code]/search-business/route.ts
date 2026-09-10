import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { searchSchema } from "@/lib/validators";
import { verifyManagementSession } from "@/lib/session";
import { searchBusiness } from "@/lib/google-places";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/audit";

export async function POST(req: Request, { params }: { params: { code: string } }) {
  const ip = getClientIp(req) ?? "unknown";
  const rl = checkRateLimit(`search:${ip}`, 30, 10 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Terlalu banyak permintaan pencarian." }, { status: 429 });
  }

  const token = req.headers.get("cookie")?.match(new RegExp(`mgmt_${params.code}=([^;]+)`))?.[1];
  const db = supabaseAdmin();
  const { data: card } = await db.from("cards").select("id, status").eq("public_code", params.code).single();

  if (!card || !token || !(await verifyManagementSession(card.id, token))) {
    return NextResponse.json({ error: "Sesi tidak valid, silakan masukkan PIN kembali." }, { status: 401 });
  }
  if (card.status !== "UNINITIALIZED") {
    return NextResponse.json({ error: "Kartu sudah aktif." }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const parsed = searchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Kata kunci tidak valid" }, { status: 400 });
  }

  try {
    const results = await searchBusiness(parsed.data.query);
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: "Gagal mencari bisnis. Coba lagi." }, { status: 502 });
  }
}
