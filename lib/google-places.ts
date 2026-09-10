import "server-only";

export interface PlaceResult {
  placeId: string;
  displayName: string;
  formattedAddress: string;
  googleMapsUrl: string;
  writeReviewUrl: string;
}

/**
 * Text Search (Places API New). API key HANYA dibaca dari env server,
 * tidak pernah dikirim ke browser.
 */
export async function searchBusiness(query: string): Promise<PlaceResult[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY belum diset");
  if (!query || query.trim().length < 2) return [];

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.googleMapsUri",
    },
    body: JSON.stringify({ textQuery: query, languageCode: "id" }),
    // Google Places API bisa lambat; batasi agar UX tetap responsif.
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error(`Google Places API error: ${res.status}`);
  }

  const data = await res.json();
  const places = data.places ?? [];

  return places.slice(0, 8).map((p: any) => ({
    placeId: p.id,
    displayName: p.displayName?.text ?? "Tanpa nama",
    formattedAddress: p.formattedAddress ?? "",
    googleMapsUrl: p.googleMapsUri ?? `https://www.google.com/maps/place/?q=place_id:${p.id}`,
    // Metode universal & stabil untuk mengarahkan langsung ke form
    // "Write a review" Google berdasarkan place_id.
    writeReviewUrl: `https://search.google.com/local/writereview?placeid=${p.id}`,
  }));
}

/** Validasi sederhana: pastikan target redirect memang milik domain Google. */
export function isAllowedGoogleTarget(url: string): boolean {
  try {
    const u = new URL(url);
    const allowedHosts = [
      "search.google.com",
      "www.google.com",
      "google.com",
      "maps.google.com",
      "goo.gl",
    ];
    return allowedHosts.some((h) => u.hostname === h || u.hostname.endsWith("." + h));
  } catch {
    return false;
  }
}
