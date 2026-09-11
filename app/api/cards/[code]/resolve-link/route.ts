import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { mapsLinkSchema } from "@/lib/validators";
import { verifyManagementSession } from "@/lib/session";
import { resolveMapsLink } from "@/lib/google-maps-link";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/audit";

export async function POST(req: Request, { params }: { params: { code: string } }) {
  const ip = getClientIp(req) ?? "unknown";
  const rl = checkRateLimit(`resolve-link:${ip}`, 30, 10 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Terlalu banyak percobaan. Coba lagi nanti." }, { status: 429 });
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
  const parsed = mapsLinkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Link tidak valid." }, { status: 400 });
  }

  try {
    const result = await resolveMapsLink(parsed.data.link);
    return NextResponse.json({ result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    const messages: Record<string, string> = {
      BUKAN_LINK_GOOGLE_MAPS: "Link harus berasal dari Google Maps.",
      CID_NOT_FOUND: "Tidak bisa membaca data bisnis dari link ini. Pastikan link diambil dari tombol 'Share' pada lokasi bisnis yang benar (bukan hasil pencarian umum), lalu coba lagi.",
    };
    return NextResponse.json({ error: messages[msg] ?? "Gagal memproses link. Coba lagi." }, { status: 400 });
  }
}
