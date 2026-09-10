import "server-only";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

const SESSION_TTL_MINUTES = 15;

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Dibuat setelah PIN terverifikasi. Token mentah dikirim ke client
 *  sekali saja (mis. lewat cookie httpOnly); yang disimpan di DB hanya hash-nya. */
export async function createManagementSession(cardId: string, pinVersion: number) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60 * 1000);

  const db = supabaseAdmin();
  const { error } = await db.from("management_sessions").insert({
    card_id: cardId,
    token_hash: hashToken(token),
    pin_version: pinVersion,
    expires_at: expiresAt.toISOString(),
  });
  if (error) throw error;

  return { token, expiresAt };
}

/** Mengembalikan card_id jika token valid, belum kedaluwarsa, belum
 *  direvoke, dan pin_version-nya masih sama dengan kartu saat ini
 *  (reset kartu akan menaikkan pin_version sehingga session lama otomatis invalid). */
export async function verifyManagementSession(cardId: string, token: string) {
  const db = supabaseAdmin();
  const { data: card } = await db
    .from("cards")
    .select("id, pin_version, status")
    .eq("id", cardId)
    .single();

  if (!card) return false;

  const { data: session } = await db
    .from("management_sessions")
    .select("id, expires_at, revoked_at, pin_version")
    .eq("card_id", cardId)
    .eq("token_hash", hashToken(token))
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) return false;
  if (new Date(session.expires_at) < new Date()) return false;
  if (session.pin_version !== card.pin_version) return false;

  return true;
}

export { hashToken, SESSION_TTL_MINUTES };
