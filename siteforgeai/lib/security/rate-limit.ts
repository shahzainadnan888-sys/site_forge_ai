import { getTrustedClientIp } from "@/lib/security/client-ip";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

const MAX_BUCKETS = 20_000;

function pruneIfNeeded() {
  if (buckets.size <= MAX_BUCKETS) return;
  const now = Date.now();
  for (const [k, b] of buckets) {
    if (now >= b.resetAt) buckets.delete(k);
  }
}

export class RateLimitError extends Error {
  readonly retryAfterSec: number;

  constructor(retryAfterSec: number) {
    super("Rate limit exceeded.");
    this.name = "RateLimitError";
    this.retryAfterSec = retryAfterSec;
  }
}

function consume(key: string, limit: number, windowMs: number) {
  pruneIfNeeded();
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || now >= current.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (current.count >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    throw new RateLimitError(retryAfterSec);
  }
  current.count += 1;
  buckets.set(key, current);
}

/**
 * Enforce a rate limit per user (if userId) or per IP (if not). For expensive
 * routes, also call with a second key and IP identity to cap abuse from one network.
 */
export function enforceRateLimit(
  req: Request,
  keyBase: string,
  options: { limit: number; windowMs: number; userId?: string }
) {
  const identity = options.userId ? `uid:${options.userId}` : `ip:${getTrustedClientIp(req)}`;
  consume(`${keyBase}:${identity}`, options.limit, options.windowMs);
}

/** Additional per-IP limit (same keyBase pattern, e.g. after user-scoped pass). */
export function enforceRateLimitByIp(
  req: Request,
  keyBase: string,
  options: { limit: number; windowMs: number }
) {
  const ip = getTrustedClientIp(req);
  consume(`${keyBase}:iponly:${ip}`, options.limit, options.windowMs);
}
