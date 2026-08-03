import { getCache, ipAddress } from '@vercel/functions';
import { decideRateLimitAction, RATE_LIMIT_CONFIG } from './lib/rateLimitDecision';

// Pre-beta WAF work, 2026-08-03 (see SECURITY.md for the full plan and the
// native Vercel WAF rules this complements). Vercel's own automatic DDoS
// mitigation is already on for every request regardless of this file --
// this adds a second, behavioral layer: per-IP throttling that escalates
// to a temporary ban after repeated violations, using Vercel's Runtime
// Cache to track state across requests (no new external service).
//
// Ships in LOG_ONLY mode: computes and logs exactly what it would do, but
// never actually blocks a request. Safe to deploy straight to production
// in this state -- flip to false only after reviewing real Vercel function
// logs for a representative period and confirming no legitimate traffic
// gets caught (mirrors the native WAF's own log -> preview -> production
// staged rollout, just as a code flag instead of a firewall-rule state).
const LOG_ONLY = true;

const cache = getCache({ namespace: 'waf' });

async function getCachedNumber(key: string): Promise<number> {
  const value = await cache.get(key);
  return typeof value === 'number' ? value : 0;
}

export default async function middleware(request: Request) {
  const ip = ipAddress(request);
  // Can't rate-limit what we can't identify -- fail open rather than risk
  // blocking legitimate traffic behind a missing/unrecognized IP.
  if (!ip) return;

  const banKey = `ban:${ip}`;
  const isBanned = (await cache.get(banKey)) === true;

  const windowBucket = Math.floor(Date.now() / 1000 / RATE_LIMIT_CONFIG.windowSeconds);
  const rateKey = `rate:${ip}:${windowBucket}`;
  const violationKey = `violations:${ip}`;

  let requestCountInWindow = 0;
  let violationCountBeforeThisRequest = 0;

  if (!isBanned) {
    // Read-then-write, not atomic -- Runtime Cache has no increment
    // primitive. Acceptable here: this is a defense-in-depth behavioral
    // layer on top of Vercel's always-on volumetric DDoS mitigation, not
    // the sole line of defense, so undercounting a burst by a request or
    // two doesn't meaningfully weaken it.
    requestCountInWindow = (await getCachedNumber(rateKey)) + 1;
    await cache.set(rateKey, requestCountInWindow, { ttl: RATE_LIMIT_CONFIG.windowSeconds * 2 });
    violationCountBeforeThisRequest = await getCachedNumber(violationKey);
  }

  const decision = decideRateLimitAction({
    isBanned,
    requestCountInWindow,
    violationCountBeforeThisRequest,
  });

  if (decision.action === 'allow') return;

  if (decision.action === 'throttle') {
    await cache.set(violationKey, decision.newViolationCount, {
      ttl: RATE_LIMIT_CONFIG.violationWindowSeconds,
    });
    if (decision.shouldBan) {
      await cache.set(banKey, true, { ttl: RATE_LIMIT_CONFIG.banDurationSeconds });
    }
  }

  const reason =
    decision.action === 'banned'
      ? 'banned'
      : decision.shouldBan
        ? 'throttle-escalated-to-ban'
        : 'throttle';
  const path = new URL(request.url).pathname;
  console.log(`[waf] ${LOG_ONLY ? 'would block' : 'blocked'} ip=${ip} path=${path} reason=${reason}`);

  if (LOG_ONLY) return;

  if (decision.action === 'banned') {
    return new Response('Too many requests', { status: 403 });
  }
  return new Response('Too many requests', {
    status: 429,
    headers: { 'Retry-After': String(RATE_LIMIT_CONFIG.windowSeconds) },
  });
}

export const config = {
  // Excludes /assets/* -- immutable, content-hashed static files already
  // well served by Vercel's CDN cache + native DDoS mitigation; including
  // them here would add cache-bypassing compute to every JS/CSS/font
  // request on every pageview for no real security benefit. Everything
  // else (the SPA shell, every hash-route via vercel.json's catch-all
  // rewrite, sw.js, manifest.webmanifest) stays in scope.
  matcher: ['/((?!assets/).*)'],
};
