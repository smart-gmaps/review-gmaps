import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { pinSchema } from "@/lib/validators";
import { createManagementSession } from "@/lib/session";
import { logAudit, getClientIp } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request, { params }: { params: { code: string } }) {
  const ip = getClientIp(req) ?? "unknown";
  const rl = checkRateLimit(`verify-pin:${ip}`, 20, 10 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Terlalu banyak percobaan. Coba lagi nanti." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = pinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "PIN tidak valid" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: cardId, error } = await db.rpc("rpc_verify_pin", {
    p_public_code: params.code,
    p_pin: parsed.data.pin,
  });

  if (error) {
    const code = error.message.includes("LOCKED")
      ? "LOCKED"
      : error.message.includes("NOT_FOUND")
        ? "NOT_FOUND"
        : error.message.includes("DISABLED")
          ? "DISABLED"
          : "INVALID_PIN";

    await logAudit({ action: "verify_pin", success: false, ip, metadata: { code: params.code, reason: code } });

    const messages: Record<string, string> = {
      LOCKED: "Terlalu banyak percobaan salah. Kartu dikunci sementara, coba lagi nanti.",
      NOT_FOUND: "Kartu tidak ditemukan.",
      DISABLED: "Kartu tidak aktif.",
      INVALID_PIN: "PIN salah.",
    };
    const status = code === "NOT_FOUND" ? 404 : code === "LOCKED" ? 423 : 400;
    return NextResponse.json({ error: messages[code] }, { status });
  }

  const { data: card } = await db.from("cards").select("pin_version").eq("id", cardId).single();
  const session = await createManagementSession(cardId as string, card!.pin_version);

  await logAudit({ action: "verify_pin", success: true, cardId: cardId as string, ip });

  const res = NextResponse.json({ ok: true, cardId, expiresAt: session.expiresAt });
  res.cookies.set(`mgmt_${params.code}`, session.token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 15 * 60,
  });
  return res;
}
