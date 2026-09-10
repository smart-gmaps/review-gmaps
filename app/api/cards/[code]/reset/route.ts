import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyManagementSession } from "@/lib/session";
import { logAudit, getClientIp } from "@/lib/audit";

export async function POST(req: Request, { params }: { params: { code: string } }) {
  const ip = getClientIp(req) ?? "unknown";
  const token = req.headers.get("cookie")?.match(new RegExp(`mgmt_${params.code}=([^;]+)`))?.[1];
  const db = supabaseAdmin();

  const { data: card } = await db.from("cards").select("id").eq("public_code", params.code).single();
  if (!card || !token || !(await verifyManagementSession(card.id, token))) {
    return NextResponse.json({ error: "Sesi tidak valid, silakan masukkan PIN kembali." }, { status: 401 });
  }

  const { error } = await db.rpc("rpc_reset_card", { p_card_id: card.id });
  if (error) {
    return NextResponse.json({ error: "Gagal mereset kartu." }, { status: 500 });
  }

  await logAudit({ action: "reset_card", success: true, cardId: card.id, ip, metadata: { by: "card_holder" } });

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(`mgmt_${params.code}`);
  return res;
}
