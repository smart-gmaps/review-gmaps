import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Client dengan SERVICE ROLE KEY — bypass RLS.
 * JANGAN PERNAH diimpor dari file yang berjalan di browser.
 * `server-only` di atas akan membuat build gagal jika itu terjadi.
 */
export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset");
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
