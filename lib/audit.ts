import "server-only";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

export function hashIp(ip: string) {
  const salt = process.env.IP_HASH_SALT ?? "change-me";
  return crypto.createHash("sha256").update(salt + ip).digest("hex");
}

export async function logAudit(entry: {
  actorUserId?: string | null;
  cardId?: string | null;
  action: string;
  success: boolean;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const db = supabaseAdmin();
  await db.from("audit_logs").insert({
    actor_user_id: entry.actorUserId ?? null,
    card_id: entry.cardId ?? null,
    action: entry.action,
    success: entry.success,
    ip_hash: entry.ip ? hashIp(entry.ip) : null,
    user_agent: entry.userAgent ?? null,
    metadata: entry.metadata ?? {},
  });
}

export function getClientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}
