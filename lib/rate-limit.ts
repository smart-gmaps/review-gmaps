import "server-only";

/**
 * Rate limiter in-memory sederhana untuk melengkapi proteksi
 * per-kartu di database (lihat rpc_verify_pin).
 *
 * PENTING: Vercel serverless functions tidak menjamin instance yang
 * sama menangani setiap request, sehingga limiter in-memory ini TIDAK
 * cukup untuk production multi-instance. Untuk production, ganti
 * dengan Upstash Redis + @upstash/ratelimit (lihat README bagian
 * "Rate limiting production"). Ini disediakan sebagai baseline agar
 * proyek tetap berjalan tanpa dependency tambahan saat development.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count };
}
