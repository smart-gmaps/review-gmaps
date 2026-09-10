import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";
import { cardActionSchema } from "@/lib/validators";
import { logAudit, getClientIp } from "@/lib/audit";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = cardActionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Aksi tidak valid" }, { status: 400 });

  const db = supabaseAdmin();
  const ip = getClientIp(req);
  const { action } = parsed.data;

  if (action === "disable" || action === "enable") {
    const { error } = await db
      .from("cards")
      .update({ status: action === "disable" ? "DISABLED" : "UNINITIALIZED", updated_at: new Date().toISOString() })
      .eq("id", params.id);
    if (error) return NextResponse.json({ error: "Gagal memperbarui kartu" }, { status: 500 });
    await logAudit({ action: `admin_${action}`, success: true, cardId: params.id, actorUserId: admin.user.id, ip });
    return NextResponse.json({ ok: true });
  }

  if (action === "reset") {
    const { error } = await db.rpc("rpc_reset_card", { p_card_id: params.id });
    if (error) return NextResponse.json({ error: "Gagal mereset kartu" }, { status: 500 });
    await logAudit({ action: "admin_reset", success: true, cardId: params.id, actorUserId: admin.user.id, ip });
    return NextResponse.json({ ok: true });
  }

  if (action === "reset-pin") {
    const { data: pin, error } = await db.rpc("rpc_admin_reset_pin", { p_card_id: params.id });
    if (error) return NextResponse.json({ error: "Gagal reset PIN" }, { status: 500 });
    await logAudit({ action: "admin_reset_pin", success: true, cardId: params.id, actorUserId: admin.user.id, ip });
    // PIN baru (plaintext) hanya dikembalikan sekali di response ini.
    return NextResponse.json({ ok: true, newPin: pin });
  }

  return NextResponse.json({ error: "Aksi tidak dikenali" }, { status: 400 });
}
