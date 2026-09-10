import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";
import { generateCardsSchema } from "@/lib/validators";
import { logAudit, getClientIp } from "@/lib/audit";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = generateCardsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Jumlah tidak valid (1-500)" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db.rpc("rpc_generate_cards", {
    p_count: parsed.data.count,
    p_admin: admin.user.id,
  });

  if (error) {
    return NextResponse.json({ error: "Gagal membuat kartu" }, { status: 500 });
  }

  await logAudit({
    action: "generate_cards",
    success: true,
    actorUserId: admin.user.id,
    ip: getClientIp(req),
    metadata: { count: parsed.data.count },
  });

  // data: [{ id, public_code, pin }] — PIN plaintext hanya muncul di
  // response ini, sekali saja, untuk keperluan cetak kartu.
  return NextResponse.json({ cards: data });
}
