import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { activateSchema } from "@/lib/validators";
import { verifyManagementSession } from "@/lib/session";
import { isAllowedGoogleTarget } from "@/lib/google-places";
import { logAudit, getClientIp } from "@/lib/audit";

export async function POST(req: Request, { params }: { params: { code: string } }) {
  const ip = getClientIp(req) ?? "unknown";
  const token = req.headers.get("cookie")?.match(new RegExp(`mgmt_${params.code}=([^;]+)`))?.[1];
  const db = supabaseAdmin();

  const { data: card } = await db.from("cards").select("id, status").eq("public_code", params.code).single();
  if (!card || !token || !(await verifyManagementSession(card.id, token))) {
    return NextResponse.json({ error: "Sesi tidak valid, silakan masukkan PIN kembali." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = activateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data aktivasi tidak lengkap" }, { status: 400 });
  }
  const d = parsed.data;

  // FR-011: validasi target berasal dari domain Google yang diizinkan.
  if (!isAllowedGoogleTarget(d.writeReviewUrl) || !isAllowedGoogleTarget(d.googleMapsUrl)) {
    await logAudit({ action: "activate", success: false, cardId: card.id, ip, metadata: { reason: "invalid_target" } });
    return NextResponse.json({ error: "Target tidak valid." }, { status: 400 });
  }

  const { data: ok, error } = await db.rpc("rpc_activate_card", {
    p_card_id: card.id,
    p_business_id: d.placeId,
    p_business_name: d.businessName,
    p_business_address: d.businessAddress,
    p_google_review_url: d.writeReviewUrl,
    p_google_maps_url: d.googleMapsUrl,
  });

  if (error || !ok) {
    await logAudit({ action: "activate", success: false, cardId: card.id, ip, metadata: { reason: "already_active_or_error" } });
    return NextResponse.json({ error: "Kartu sudah diaktifkan sebelumnya." }, { status: 409 });
  }

  await logAudit({ action: "activate", success: true, cardId: card.id, ip, metadata: { businessName: d.businessName } });

  return NextResponse.json({ ok: true });
}
