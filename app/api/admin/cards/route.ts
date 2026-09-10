import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const q = searchParams.get("q");
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = 25;

  const db = supabaseAdmin();
  let query = db
    .from("cards")
    .select("id, public_code, status, business_name, business_address, activated_at, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (status) query = query.eq("status", status);
  if (q) query = query.or(`public_code.ilike.%${q}%,business_name.ilike.%${q}%`);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: "Gagal memuat data" }, { status: 500 });

  return NextResponse.json({ cards: data, total: count, page, pageSize });
}
