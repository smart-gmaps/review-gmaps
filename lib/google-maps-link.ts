import "server-only";

export interface ResolvedMapsLink {
  cid: string;
  businessName: string;
  mapsUrl: string;
  writeReviewUrl: string;
}

const ALLOWED_INPUT_HOSTS = [
  "maps.app.goo.gl",
  "goo.gl",
  "g.page",
  "www.google.com",
  "google.com",
  "maps.google.com",
];

const SHORTLINK_HOSTS = ["maps.app.goo.gl", "goo.gl", "g.page"];

function normalizeUrl(raw: string): URL {
  let s = raw.trim();
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  return new URL(s);
}

/** Ambil CID (Customer/Place numeric ID) dari sebuah URL Google Maps.
 *  Dicoba dari beberapa pola berbeda karena format link Maps bervariasi
 *  tergantung cara dibagikan (app share, desktop copy link, dst). */
function extractCid(url: string): string | null {
  try {
    const u = new URL(url);
    const qCid = u.searchParams.get("cid") || u.searchParams.get("ludocid");
    if (qCid && /^\d+$/.test(qCid)) return qCid;
  } catch {
    // lanjut ke pola berikutnya
  }

  // Pola umum di URL hasil klik lokasi: .../data=...!1s0x<hex>:0x<hex-cid>!...
  const hexMatch = url.match(/!1s0x[0-9a-fA-F]+:0x([0-9a-fA-F]+)/);
  if (hexMatch) {
    try {
      return BigInt("0x" + hexMatch[1]).toString(10);
    } catch {
      return null;
    }
  }

  return null;
}

function extractName(url: string): string | null {
  try {
    const decoded = decodeURIComponent(url);
    const match = decoded.match(/\/maps\/place\/([^/@]+)/);
    if (match) return match[1].replace(/\+/g, " ").trim();
  } catch {
    // abaikan
  }
  return null;
}

/** Validasi target redirect akhir (dipakai sebelum menyimpan & sebelum
 *  redirect sungguhan) — memastikan URL memang milik domain Google. */
export function isAllowedGoogleTarget(url: string): boolean {
  try {
    const u = new URL(url);
    const allowedHosts = ["search.google.com", "www.google.com", "google.com", "maps.google.com", "goo.gl"];
    return allowedHosts.some((h) => u.hostname === h || u.hostname.endsWith("." + h));
  } catch {
    return false;
  }
}

/**
 * Menerima link share Google Maps dari pemilik bisnis, mengikuti redirect
 * jika berupa short link, lalu mengekstrak CID untuk menyusun link
 * "Tulis Review" langsung. Tidak memerlukan Google Places API / billing.
 */
export async function resolveMapsLink(rawUrl: string): Promise<ResolvedMapsLink> {
  const parsed = normalizeUrl(rawUrl);

  if (!ALLOWED_INPUT_HOSTS.some((h) => parsed.hostname === h || parsed.hostname.endsWith("." + h))) {
    throw new Error("BUKAN_LINK_GOOGLE_MAPS");
  }

  let finalUrl = parsed.toString();

  if (SHORTLINK_HOSTS.includes(parsed.hostname)) {
    const res = await fetch(parsed.toString(), {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ReviewCardBot/1.0)" },
    });
    finalUrl = res.url || finalUrl;
  }

  const cid = extractCid(finalUrl) ?? extractCid(parsed.toString());
  if (!cid) {
    throw new Error("CID_NOT_FOUND");
  }

  const businessName = extractName(finalUrl) ?? extractName(parsed.toString()) ?? "Bisnis Anda";

  return {
    cid,
    businessName,
    mapsUrl: `https://www.google.com/maps?cid=${cid}`,
    writeReviewUrl: `https://search.google.com/local/writereview?placeid=${cid}`,
  };
}
