import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("cards")
    .select("public_code, status, business_name, activated_at, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Gagal export" }, { status: 500 });

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const header = "public_code,qr_url,status,business_name,activated_at,created_at";
  const rows = (data ?? []).map((c) =>
    [c.public_code, `${base}/${c.public_code}`, c.status, c.business_name ?? "", c.activated_at ?? "", c.created_at]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  const csv = [header, ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cards-export.csv"`,
    },
  });
}
