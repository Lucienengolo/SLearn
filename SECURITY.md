# Security: WAF, rate limiting, and DDoS response

Pre-beta hardening (2026-08-03), covering the Vercel-hosted frontend (`s-learn-beta.vercel.app`). The application backend (auth, database REST API, all edge functions) runs entirely on Supabase and is out of scope here — the browser calls it directly, so nothing on this page protects it. Supabase's own abuse surface is covered by the RLS/security work in `TODOS.md`, not a WAF.

## Layers of defense, outside-in

1. **Vercel's automatic DDoS mitigation** — always on, every plan including Hobby, no configuration. Covers volumetric L3/L4/L7 attacks. Nothing to set up; this has been protecting the site since it was first deployed to Vercel.
2. **Vercel WAF custom rules** (this doc, section below) — known-bad-signature blocking (exploit-probe paths) and a coarse rate-limit backstop. Configured via the `vercel firewall` CLI. **Not yet published** — see setup steps below; this is founder-run, not something Claude can execute (no Vercel CLI/login in that environment, and rule publishing is deliberately a human-triggered action per Vercel's own guidance — a bad rule can silently block the whole site).
3. **`middleware.ts`** (repo root) — adaptive per-IP behavioral layer: throttles an IP that exceeds a request-rate threshold, escalates to a temporary ban after repeated violations within an hour, using Vercel's Runtime Cache to track state across requests. This is the layer that actually delivers "recognize attack patterns and escalate based on behavior" — the native WAF's persistent-ban action (`--duration`) is Pro/Enterprise-only, and this project is on Hobby.

   **Currently ships in `LOG_ONLY = true` mode** — it computes and logs exactly what it would block but never actually blocks anything. This is intentional and safe to have live in production as-is. Before enforcing:
   1. Deploy with `LOG_ONLY = true` (already the default).
   2. Watch Vercel's function logs (Dashboard → Project → Logs, filter for `[waf]`) for a representative period — at least a few days of real traffic, ideally spanning a weekday and weekend.
   3. Confirm nothing that logged `would block` was a real user, a search crawler, or your own tooling (Playwright/Lighthouse CI run against local builds, not the deployed URL, so they won't appear here — but double-check anyway).
   4. Flip `LOG_ONLY` to `false` in `middleware.ts`, commit, push.
   5. Watch the logs again after enforcing for the first 24h in case anything needs a threshold adjustment (`lib/rateLimitDecision.ts`'s `RATE_LIMIT_CONFIG` — window size, throttle threshold, violation escalation threshold, ban duration are all named constants there).

## Setting up the native Vercel WAF rules

Not yet done — requires the Vercel CLI, which you'll need to install and authenticate yourself:

```bash
npm i -g vercel
vercel login
vercel link          # project is already registered (.vercel/project.json exists) -- this just re-confirms the link in your own session
```

Both rules below follow Vercel's recommended staged rollout: **log everywhere → review the dashboard → block in preview → block in production.** Don't skip stages — go through `vercel firewall diff` and `vercel firewall publish --yes` yourself at each step; these are staged as drafts on purpose so a mistake doesn't go live before you've looked at it.

### Rule 1 — block known exploit/config-probe paths

This app has no `/wp-admin`, `/.env`, etc. — but because `vercel.json`'s catch-all rewrite sends *every* unmatched path to `/index.html`, a bot probing for these currently gets a 200 (full SPA shell) instead of a fast 404. Blocking them at the edge is close to zero false-positive risk and saves the wasted bandwidth/compute.

```bash
# Stage 1: log only
vercel firewall rules add "Block exploit probes" \
  --condition '{"type":"path","op":"inc","value":["/wp-admin","/wp-login.php","/xmlrpc.php","/.env","/.git/config","/phpmyadmin","/admin.php","/config.php",".aws/credentials"]}' \
  --action log --yes

vercel firewall diff
vercel firewall publish --yes
```

Open the traffic dashboard (get the rule ID from `vercel firewall rules list --json`, get your team slug from the Vercel dashboard URL):

```
https://vercel.com/<your-team-slug>/s-learn/firewall/traffic?filter=<ruleId>
```

Confirm only bot noise is matching (should be near-zero real traffic, since these paths don't exist in the app). Then:

```bash
# Stage 2: block in preview only
vercel firewall rules edit "Block exploit probes" \
  --action deny \
  --condition '{"type":"path","op":"inc","value":["/wp-admin","/wp-login.php","/xmlrpc.php","/.env","/.git/config","/phpmyadmin","/admin.php","/config.php",".aws/credentials"]}' \
  --condition '{"type":"environment","op":"eq","value":"preview"}' \
  --yes
vercel firewall publish --yes
```

Hit one of the paths on a preview URL, confirm it's blocked, then remove the `environment` condition to enforce in production too:

```bash
# Stage 3: block in production
vercel firewall rules edit "Block exploit probes" \
  --action deny \
  --condition '{"type":"path","op":"inc","value":["/wp-admin","/wp-login.php","/xmlrpc.php","/.env","/.git/config","/phpmyadmin","/admin.php","/config.php",".aws/credentials"]}' \
  --yes
vercel firewall publish --yes
```

### Rule 2 — coarse rate-limit backstop

A generous, zero-maintenance first-line filter at Vercel's edge (evaluated before your origin/middleware even runs), complementing `middleware.ts`'s finer-grained behavioral logic rather than replacing it.

```bash
# Stage 1: log only, generous limit
vercel firewall rules add "Coarse rate limit" \
  --action rate_limit \
  --rate-limit-window 60 \
  --rate-limit-requests 600 \
  --rate-limit-keys ip \
  --rate-limit-action log \
  --yes
vercel firewall diff
vercel firewall publish --yes
```

Review the dashboard the same way as Rule 1. Once you're confident 600 req/min/IP genuinely only catches abuse (note: counters are per-region, so a distributed client can collectively exceed this by roughly the number of Vercel regions serving your traffic — that's expected, not a bug), tighten and enforce:

```bash
vercel firewall rules edit "Coarse rate limit" \
  --rate-limit-action rate_limit \
  --yes
vercel firewall publish --yes
```

This returns a `429` instead of just logging once enforced.

## Active-incident response

### 1. Confirm it's really an attack

Check the dashboard traffic view, or if the project has Observability Plus:

```bash
vc metrics vercel.firewall_action.count \
  --group-by waf_action \
  --since 1h \
  --granularity 5m \
  --format json
```

Look for a sharp, sustained spike in requests, a concentrated set of source IPs/ASNs/geos, or an unusual path (e.g. everything hitting `/` or a single endpoint repeatedly). Also check `[waf]` log lines from `middleware.ts` for a burst of `throttle`/`banned` entries clustered around the same time.

### 2. Escalate

- **If `middleware.ts` is still in `LOG_ONLY` mode**: flip it to `false` immediately, commit, push. This alone stops the adaptive layer from just watching and starts it actually throttling/banning.
- **If the attack is broad/volumetric and the above isn't enough**: enable Attack Mode. This is a human-only action — Vercel blocks it for scripts/agents given its severity, so this step has to be run by you directly:

  ```bash
  vercel firewall attack-mode enable --duration 1h --yes
  ```

  Unverified visitors see a challenge page; verified bots/search crawlers are exempt. Escalate the duration (`6h`, `24h`) if the attack is still ongoing when it expires. Disable when clear:

  ```bash
  vercel firewall attack-mode disable --yes
  ```

- **If the attack is a small number of identifiable IPs**: block them directly, no need for the blunter Attack Mode:

  ```bash
  vercel firewall ip-blocks block 1.2.3.4 --notes "Active incident $(date +%F)" --yes
  vercel firewall publish --yes
  ```

- **If you need to unblock a legitimate client that got caught** (your own office IP, a monitoring service, etc.):

  ```bash
  vercel firewall system-bypass add <ip-or-cidr> --notes "Trusted -- <what it is>" --yes
  ```

  System bypass takes effect immediately, no publish needed, and exempts the IP from all firewall checks (not just this incident's rules).

### 3. If Vercel's own platform is struggling, not just this project

Contact Vercel support (https://vercel.com/help) — the automatic DDoS mitigation is platform-level infrastructure; if you suspect it's not keeping up, that's their operational problem to help with directly, not something more firewall config on your end can fix.

### 4. After the incident: postmortem

Fill this in and keep it (append to this file or wherever the team tracks incidents):

```
## Incident: <date>

- **Detected**: how, and how long after it started
- **Duration**: start/end (approx)
- **Scale**: peak req/s, source IPs/ASNs/geos if identifiable
- **Response taken**: which of the above steps, in what order, and when
- **Impact**: any real user-facing downtime/errors, and for how long
- **Root cause** (if known): targeted attack, scraper, misconfigured
  client, credential-stuffing attempt, etc.
- **Follow-ups**: threshold/rule changes made as a result, anything
  that should have caught this sooner
```

## Known limitations, stated plainly

- Rate-limit counters (both `middleware.ts`'s and the native WAF's) are **per-region** — a client distributed across multiple Vercel regions can collectively exceed a configured limit by roughly the number of regions involved. This is a real gap for a sufficiently sophisticated distributed attacker; the native platform-level DDoS mitigation (layer 1 above) is the actual backstop for that class of attack, not the rate-limit rules.
- `middleware.ts`'s counters use read-then-write against Runtime Cache, not an atomic increment (the API doesn't expose one) — under heavy concurrent load from a single IP, a few requests can be undercounted. Acceptable for a defense-in-depth behavioral layer, not acceptable if this were the sole rate-limiting mechanism.
- This document covers the Vercel frontend only. If Supabase itself ever needs a dedicated WAF (e.g., if abuse concentrates on auth/API endpoints rather than the frontend), that requires setting up a Supabase custom domain and fronting *that* with something like Cloudflare — a separate, larger piece of work, not covered here.
