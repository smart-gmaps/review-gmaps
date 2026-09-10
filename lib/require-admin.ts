import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Mengembalikan { user } jika caller adalah admin aktif yang login lewat
 *  Supabase Auth (cookie session), atau null jika tidak. */
export async function requireAdmin() {
  const authClient = supabaseServer();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) return null;

  const db = supabaseAdmin();
  const { data: profile } = await db
    .from("profiles")
    .select("id, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !profile.is_active) return null;

  return { user, profile };
}
