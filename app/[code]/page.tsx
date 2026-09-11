import { redirect, notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isAllowedGoogleTarget } from "@/lib/google-maps-link";
import { logAudit } from "@/lib/audit";
import ActivateCardClient from "./ActivateCardClient";

export const dynamic = "force-dynamic";

export default async function PublicCardPage({ params }: { params: { code: string } }) {
  const db = supabaseAdmin();
  const { data: card } = await db
    .from("cards")
    .select("id, status, google_review_url, business_name")
    .eq("public_code", params.code)
    .maybeSingle();

  if (!card) {
    notFound();
  }

  if (card.status === "ACTIVE") {
    // FR-011 / AC-019: validasi ulang target sebelum redirect agar tidak
    // pernah membuka celah open-redirect meskipun data di DB korup.
    if (card.google_review_url && isAllowedGoogleTarget(card.google_review_url)) {
      await logAudit({ action: "redirect", success: true, cardId: card.id });
      redirect(card.google_review_url);
    }

    await logAudit({ action: "redirect", success: false, cardId: card.id, metadata: { reason: "invalid_target" } });
    return (
      <div className="card-surface w-full max-w-sm p-8 text-center">
        <h1 className="text-lg font-semibold text-gray-900">Terjadi kesalahan</h1>
        <p className="mt-2 text-sm text-brand-muted">
          Target review untuk kartu ini tidak valid. Hubungi pemilik bisnis atau admin.
        </p>
      </div>
    );
  }

  if (card.status === "DISABLED") {
    return (
      <div className="card-surface w-full max-w-sm p-8 text-center">
        <h1 className="text-lg font-semibold text-gray-900">Kartu tidak aktif</h1>
        <p className="mt-2 text-sm text-brand-muted">
          Kartu ini telah dinonaktifkan. Hubungi admin jika Anda merasa ini sebuah kekeliruan.
        </p>
      </div>
    );
  }

  // UNINITIALIZED
  return <ActivateCardClient code={params.code} />;
}
