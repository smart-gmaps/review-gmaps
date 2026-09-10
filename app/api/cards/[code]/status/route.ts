import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(_req: Request, { params }: { params: { code: string } }) {
  const db = supabaseAdmin();
  const { data: card } = await db
    .from("cards")
    .select("status, google_review_url, business_name")
    .eq("public_code", params.code)
    .maybeSingle();

  if (!card) {
    return NextResponse.json({ status: "NOT_FOUND" }, { status: 404 });
  }

  // Endpoint ini TIDAK pernah mengembalikan URL redirect ke client untuk
  // dieksekusi via JS agar tidak membuka celah open-redirect; redirect
  // sesungguhnya dilakukan server-side di app/[code]/page.tsx.
  return NextResponse.json({
    status: card.status,
    businessName: card.status === "ACTIVE" ? card.business_name : null,
  });
}
