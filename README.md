# S@Learn — Online Learning Platform

S@Learn is a mobile-first learning platform for African markets, built on the **Longrich Design System**. It serves two audiences from a single codebase:

- **Learners** — browse free & paid courses, watch lessons, take quizzes, earn XP and certificates, and get help from **Kairos Mind**, an in-lesson AI tutor (explain / quiz / translate, powered by Claude).
- **Instructors** — a *verified-only* role. Applicants pass qualification, credential, identity and a **compulsory verification interview** before their studio is unlocked, then create courses and grade submissions.

Accounts are **single-role**: a user is either a student or an instructor, never both.

> This README consolidates the whole knowledge base (live React app + design prototypes) into one place: the architecture, the dev workstreams, and a prioritized DevOps todo list.

---

## 1. Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 18 + TypeScript, Vite |
| Styling | Tailwind CSS utilities + Longrich Design System tokens |
| Auth / DB / Storage | Supabase (Postgres, Auth, Storage) |
| Design source of truth | `_ds/longrich-design-system-…/` + `.dc.html` prototypes |
| Icons | Lucide (see `ic/`, `icons.js`) |
| AI tutor | Claude (`claude-opus-4-8`) via `supabase/functions/kairos-mind-tutor` |
| Offline / installability | `vite-plugin-pwa` — precached app shell + web manifest |
| Error tracking | Sentry (`@sentry/react`, optional — see §6 DO-6) |
| Product analytics | PostHog (`posthog-js`, optional — see §6 DO-6) |
| Uptime | `supabase/functions/health` + any external monitor (not provisioned) |

**Environment variables** (`.env`, never commit):

```
VITE_SUPABASE_URL=…
VITE_SUPABASE_ANON_KEY=…
VITE_CAL_BOOKING_LINK=…  # Cal.com event type booking URL — public, safe client-side
# server-side only (Edge Functions), NEVER exposed to the client — set via
# `supabase secrets set`, never committed:
SUPABASE_SERVICE_ROLE_KEY=…
ANTHROPIC_API_KEY=…      # powers Kairos Mind (supabase/functions/kairos-mind-tutor)
RESEND_API_KEY=…         # transactional email (instructor verification)
NOTIFY_WEBHOOK_SECRET=…  # DB-trigger → notify-application-email auth
STRIPE_SECRET_KEY=…      # Stripe Checkout (create-checkout-session, stripe-webhook)
STRIPE_WEBHOOK_SECRET=…  # verifies Stripe's webhook calls
CAL_WEBHOOK_SECRET=…     # verifies Cal.com's webhook calls (cal-webhook)
```

---

## 2. Repository map

```
App.tsx                     App shell + hash-based routing
main.tsx                    React entry
contexts/AuthContext.tsx    session, profile, signUp/signIn/signOut
lib/supabase.ts             client + all row types (Profile, Course, Lesson, …)
lib/storage.ts              lesson video/PDF upload & delete helpers
lib/guestSession.ts         guest-mode progress/XP (sessionStorage only)
lib/instructorApplications.ts  application wizard + verification pipeline data access
lib/kairosMind.ts            client for the kairos-mind-tutor edge function (SSE streaming)
lib/errorTracking.ts         Sentry init (lazy, no-op without VITE_SENTRY_DSN) + AppErrorBoundary
lib/analytics.ts             PostHog init (lazy, no-op without VITE_POSTHOG_KEY) + trackEvent/identifyUser
components/
  Auth/         AuthModal
  Home/         HomePage
  Courses/      CourseList, CourseCard, CourseDetail
  Lessons/      LessonViewer, KairosMindTutor
  Quiz/         QuizViewer
  Dashboard/    StudentDashboard, InstructorDashboard, CourseEditor
    InstructorApplication/  ApplicationWizard, VerificationPipeline
  Certificates/ CertificatesPage
  Layout/       Header
  ErrorFallback.tsx  shown by AppErrorBoundary on an unhandled render error
supabase/
  config.toml   auth settings (email confirmation, password policy), local dev stack config
  migrations/   versioned SQL: schema, RLS, instructor verification, reviewer + notifications, auth hardening, AI-tutor rate limiting
  functions/    instructor-approval, notify-application-email, kairos-mind-tutor, health (Deno edge functions)
scripts/a11y-audit.mjs      real axe-core accessibility audit (`npm run test:a11y`)
scripts/db-backup.sh        pg_dump to a timestamped custom-format dump (DATABASE_URL)
scripts/db-restore.sh       pg_restore from a db-backup.sh dump — destructive, confirms before running
lighthouserc.json           Lighthouse CI budget (accessibility/best-practices/SEO gated; perf reported only — see §6 DO-7)
.github/workflows/ci.yml       install → lint → typecheck → build, edge-function checks, migration checks, a11y audit, Lighthouse
.github/workflows/backup.yml   daily pg_dump → 90-day workflow artifact (see §6 DO-6)
vercel.json                 headers, SPA rewrite, build config

# Design prototypes (not shipped, they drive the build):
SLearn Platform.dc.html     ← latest interactive prototype (guest mode,
                              instructor verification, Aria tutor, role split)
SLearn Design Review.dc.html
current/                    baseline screens (01–08)
improved/                   iterated screens (Home, Lesson, dashboards…)
_ds/                        Longrich Design System bundle
```

---

## 3. Data model (Supabase)

Types already defined in `lib/supabase.ts`:

`profiles` · `categories` · `courses` · `lessons` · `enrollments` · `lesson_progress` · `quizzes` · `quiz_questions` · `quiz_attempts` · `certificates` · `reviews` · `instructor_applications` · `instructor_credentials` · `interview_slots` · `interviews`

All of the above are created by versioned migrations in `supabase/migrations/` (see §6 DO-1 — this used to be a TODO; it's now done).

- `instructor_applications` — applicant profile, qualifications, experience, course proposal, status (`draft → submitted → review → interview → approved/rejected`).
- `instructor_credentials` — uploaded ID / degrees / CV (private bucket refs) + verification flags.
- `interview_slots` / `interviews` — scheduled slot, panel, outcome.
- `guest_sessions` are **not** persisted server-side by design — see §5.

**Storage buckets:** `lesson-videos`, `lesson-pdfs` (public, used by `lib/storage.ts`) + `instructor-credentials` (private, owner-scoped upload/read policies).

---

## 4. Getting started (dev steps)

```bash
# 1. Install
npm install

# 2. Configure Supabase
cp .env.example .env        # fill VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY

# 3. Apply database schema & RLS
supabase db push            # applies supabase/migrations/*.sql in order

# 4. Run
npm run dev                 # Vite dev server

# 5. Build / preview
npm run build
npm run preview

# 6. Accessibility audit (real axe-core run against a served build/dev server)
npm run test:a11y
```

---

## 5. Feature workstreams & status

Legend: ✅ in codebase · 🟡 partial · 🔵 prototype only (needs build) · ⬜ not started

### A. Auth & accounts
- ✅ Email/password sign-up, sign-in, session, profile fetch (`AuthContext`).
- ✅ **Single-role enforcement.** Enforced in both UI (instructors can't enroll as students) and RLS (`enrollments` insert requires `role = 'student'`; `profiles.role`/`verified` can only be changed by the service role, never the client).
- ✅ **Guest mode** — browse + free courses with no account; achievements/XP kept in `sessionStorage` only (`lib/guestSession.ts`) and cleared when the session ends. No server writes for guests.

### B. Instructor verification
- ✅ `signUp` always creates a `student` profile; the instructor role is only ever granted by the `instructor-approval` edge function after review.
- ✅ Multi-step application wizard: profile & qualifications → experience → course proposal → credentials & identity upload → interview scheduling (`ApplicationWizard`).
- ✅ Verification pipeline UI: submitted → review → interview → decision, with a checklist (ID, credentials, background check, sample lesson) (`VerificationPipeline`).
- ✅ Backend: application storage + RLS, `instructor-approval` edge function (reviewer-only, flips `profiles.role`/`verified` only after approval), studio gating (`role === 'instructor' && verified`).
- ✅ **Interview scheduling via Cal.com** — replaces the old bare `interview_slots` table (staff manually inserting rows, applicants picking from a fixed list with no calendar sync, video link, or reminders). Applicants now book through a real Cal.com event type; `supabase/functions/cal-webhook` (`BOOKING_CREATED`/`BOOKING_RESCHEDULED`/`BOOKING_CANCELLED`) creates/updates the `interviews` row and advances the application to `interview` status. `interview_slots` is left in the schema (not dropped) but the app no longer writes to it.
  - **Live and verified end-to-end against the real Cal.com account and event type** (`support-stores-cdfbmd/s-learn-instructor-interview`, event type id `6246098`): the webhook is registered on Cal.com (`BOOKING_CREATED`/`BOOKING_RESCHEDULED`/`BOOKING_CANCELLED`, no `payloadTemplate` so the full default payload is sent) with `CAL_WEBHOOK_SECRET` set to match on both sides. Verified with a **real** booking created via the Cal.com API (not a synthetic payload): confirmed the live webhook delivery correctly created the `interviews` row (right `scheduled_at`, `cal_booking_uid`, and `meeting_url` — Cal.com's actual payload shape matched what `cal-webhook/index.ts` assumed), flipped the application to `interview`, and queued the notification; then cancelled that same booking and confirmed the `BOOKING_CANCELLED` delivery set `outcome` to `rescheduled`. The test application was reverted to its original state afterward.
  - **Still needed from you**: `VITE_CAL_BOOKING_LINK=https://cal.com/support-stores-cdfbmd/s-learn-instructor-interview` in Vercel (Production + Preview) and your local `.env` — it's a public URL, not a secret, but I don't have Vercel API access in this environment to set it myself. Until it's set, the wizard/dashboard show a "not configured yet, we'll follow up by email" fallback instead of a broken link.
  - **Real bug found and fixed while testing this** (`0015_fix_notification_trigger_pgmq_permissions.sql`): `notify_application_submitted`/`notify_interview_scheduled` (the triggers that enqueue notification emails, added in `0011`) call `pgmq.send()` but weren't `security definer`, and only the `postgres` role has `USAGE` on schema `pgmq` — so the trigger failed with "permission denied for schema pgmq" whenever it fired as `authenticated` (an applicant submitting) or `service_role` (an edge function inserting an interview). **This meant submitting an instructor application was broken from the moment `0011` shipped** until this fix — only caught because testing the Cal.com webhook exercised that trigger path for the first time via a real service-role insert, instead of only via direct SQL as `postgres` (which never hits this permission check). Fixed with the same `security definer` + pinned `search_path` pattern already used for Vault access in `0008`.
- 🔵 Reviewer/admin console UI — `profiles.is_reviewer` and the RLS to support one exist; no dashboard built yet.

### C. Learner experience
- ✅ Home, course list/detail, lesson viewer, quiz, certificates, student dashboard.
- ✅ Video/PDF upload/delete helpers (`lib/storage.ts`).
- ✅ **Paid-course checkout** (Stripe) — `CourseDetail.tsx`'s "Enroll Now" starts a Checkout session via `create-checkout-session` for `price > 0` courses; `stripe-webhook` creates the `enrollments` row (and marks `payments` completed) once Stripe confirms payment. The frontend was previously unwired to either function (a direct `enrollments.insert` for every course, including paid ones) — fixed, along with a bug in the success/cancel redirect URLs that put `?checkout=...` inside the hash fragment instead of before it, which would have corrupted the courseId `App.tsx` parses out of `window.location.hash`. Migration `0009_payments.sql` is pushed and both edge functions are deployed+active on the live project; `ALLOWED_CHECKOUT_ORIGINS` is set. **Still needed from you:** `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` as function secrets (see DO-1) — without them both functions 500 with "Payments are not configured on this deployment", same pattern as the still-missing `ANTHROPIC_API_KEY`/`RESEND_API_KEY`.
- ✅ **Kairos Mind** AI lesson tutor (explain / quiz / translate) — `supabase/functions/kairos-mind-tutor` proxies to Claude (`claude-opus-4-8`) server-side; the browser never touches `ANTHROPIC_API_KEY`. Rate-limited per user (30 msgs/hour) via `ai_tutor_requests`. Access to a lesson's content is checked with the *caller's own* RLS-scoped session, so it can't be used as a backdoor to read paid lesson content the student hasn't enrolled in.

### D. Instructor studio
- ✅ Instructor dashboard, course editor, grading queue (UI).
- ✅ Studio access wired strictly behind `role === 'instructor' && verified`, enforced in both `App.tsx` routing and RLS.

### E. Design system
- ✅ Longrich tokens bound into `tailwind.config.js` (`primary`/`gold` scales, fonts) and imported in `index.css`; prototypes are the visual reference.
- 🟡 Port final prototype screens (`SLearn Platform.dc.html`) into the React components 1:1.

---

## 6. DevOps todo list

**DO-1 · Database & security**
- [x] Author versioned migrations for every table (`supabase/migrations/0001`–`0008`).
- [x] Row-Level Security on all tables — students see only their rows; instructors only their courses/students; applications visible only to owner + reviewers.
- [x] Explicit Data API grants (`0005_auth_hardening.sql`) for every table — Supabase is phasing out auto-granting `anon`/`authenticated` on new public-schema tables (opt-out already available per-project; becomes the default for any table created after 2026-10-30 regardless of project age). Without these, RLS policies alone don't make a table reachable via the API at all.
- [x] Private `instructor-credentials` bucket + owner-scoped access (signed-URL access for reviewers is still TODO — currently reviewer access to credential files goes through the service role, not a signed-URL flow).
- [x] Seed data: categories. Sample courses aren't seeded (needs a real instructor profile FK — see migration comment for the snippet once one exists).
- [x] **Live project configured**: `hzcdcjtngxhxbzeirbmz` (region eu-west-1), linked and all 8 migrations pushed. Ran `supabase db advisors --linked` against it (not a hypothetical review) and fixed everything real it found in `0007_rls_performance_and_security_hardening.sql`:
  - Every RLS policy (public + storage.objects, ~44 policies) called `auth.uid()` unwrapped, forcing Postgres to re-evaluate it per row instead of once per query — wrapped as `(select auth.uid())` throughout.
  - `handle_new_user()` (the profile-creation trigger, SECURITY DEFINER) had no EXECUTE restriction — `anon`/`authenticated` could call it directly via `/rest/v1/rpc/handle_new_user` with elevated privileges instead of only via the trigger. Revoked.
  - 5 trigger functions had a mutable search_path (a hijacking vector); pinned on all of them.
  - 8 foreign-key columns had no covering index; added.
  - `ai_tutor_requests`'s grant included `insert` for `anon`/`authenticated`, contradicting 0006's own "service role is the only writer" comment (RLS already blocked it, but the grant didn't match intent) — revoked.
  - Merged 3 redundant permissive-SELECT policy pairs (applicant-view + reviewer-view-all) into one each. Left the lessons/quizzes/quiz_questions ALL+SELECT overlaps and pg_net's `public`-schema extension registration as documented, deliberate non-fixes — see the migration's header comment for why.
  - Verified: advisor findings went from 96 → 41, and the 41 remaining are the 2 deliberate skips above plus `unused_index` noise (expected on a brand-new database with no query history yet).
- [x] **Found and fixed a real deployment bug**: `0004`'s documented one-time setup for the notify-on-submit/interview-scheduled triggers (`alter database postgres set app.settings.notify_webhook_url = ...`) does not work on Supabase Cloud — it raises `permission denied to set parameter` even for the `postgres` role. This was only caught by actually deploying to the live project; it would have silently no-op'd forever otherwise. Fixed in `0008_notify_webhook_via_vault.sql`: the trigger functions now read the URL/secret from Supabase Vault (`supabase_vault`, preinstalled on every Cloud project) instead of a custom GUC, with SECURITY DEFINER + pinned search_path to reach Vault's locked-down `decrypted_secrets` view. Verified end-to-end locally (seeded an application, submitted it, confirmed the trigger fired with the right URL/secret/payload) before pushing. The real secret values were created directly against the live project via `vault.create_secret(...)`, never committed to a migration file.
- [x] All 4 edge functions deployed and confirmed `ACTIVE` (`instructor-approval`, `kairos-mind-tutor` — JWT-verified; `notify-application-email`, `health` — `--no-verify-jwt`, called by pg_net/uptime monitors rather than authenticated users). Hit the live `/health` endpoint directly and got back a real `{"status":"ok","db":"ok"}` against the actual database.
- [x] `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` set in Vercel (`store-s/s-learn`) across production, preview, and development — replacing 235-day-old values that predated this Supabase project (i.e. pointed somewhere else entirely). Fetched the anon key directly into the `vercel env add` command without ever printing it to a terminal or file.
- [x] `CAL_WEBHOOK_SECRET` set and verified against a real Cal.com webhook delivery (see §5.B).
- [ ] **Still needed from you** (I don't have these credentials and won't fabricate them): `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` as function secrets (`supabase secrets set ANTHROPIC_API_KEY=... RESEND_API_KEY=... STRIPE_SECRET_KEY=... STRIPE_WEBHOOK_SECRET=...`), plus `VITE_CAL_BOOKING_LINK` in Vercel/`.env` (see §5.B) — without them, Kairos Mind, application/interview emails, and paid-course checkout will all error or no-op at runtime. For the Stripe webhook secret: create the webhook endpoint in the Stripe dashboard pointing at `https://hzcdcjtngxhxbzeirbmz.functions.supabase.co/stripe-webhook` (event: `checkout.session.completed`) first — Stripe generates the signing secret at that point.
- [x] `0009_payments.sql` pushed to the live project; `create-checkout-session` and `stripe-webhook` edge functions deployed and `ACTIVE`; `ALLOWED_CHECKOUT_ORIGINS` set to the same origins as `additional_redirect_urls` in `config.toml` plus `localhost:5173`.
- [ ] **Note on the Supabase dashboard's "Stripe Sync Engine" integration card showing "Installed":** checked the live database directly — there is no `stripe` schema and no Stripe-related tables beyond this project's own `payments` table. The `wrappers` extension (0.6.2) is enabled, which the dashboard appears to count as satisfying the marketplace listing, but the actual sync service (which mirrors `customers`/`charges`/`invoices`/`subscriptions` into Postgres) has not been provisioned — it needs a Stripe API key entered through that dashboard flow, which isn't something the CLI/Management API can drive. Not required for the checkout flow above (that's a separate, already-complete, self-contained path); only worth pursuing later if you want broader Stripe reporting/reconciliation than the `payments` table gives you.

**DO-2 · CI/CD**
- [x] Commit `package.json` + lockfile + `.env.example`.
- [x] Pipeline: `install → lint → typecheck (tsc) → build`; also validates edge functions (`deno check`/`lint`) and applies migrations against a real Postgres in CI (`.github/workflows/ci.yml`).
- [x] Preview deploys per PR — via Vercel's native GitHub integration (see §9), not a custom Actions job.
- [ ] Turn on "require status checks to pass" in the repo's branch protection settings so CI failures actually block merge (a GitHub repo setting, not something a workflow file can enable on its own).

**DO-3 · Hosting & config**
- [x] Deploy the static build to Vercel + CDN — already connected to this repo.
- [x] Inject env vars per environment (dev / staging / prod) in the Vercel project dashboard — `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` set across production, preview, and development for `store-s/s-learn` (see DO-1 for details). The other vars in §9's "do not add to Vercel" list are correctly absent — they belong on Supabase, not here.
- [ ] Custom domain + HTTPS — add the domain in Vercel's dashboard and point DNS at it (Vercel issues the certificate automatically); see §9. Needs you to actually own/choose a domain — nothing to configure until then.

**DO-4 · Backend (Supabase Edge Functions)**
- [x] `instructor-approval` — reviewer action that promotes role after interview.
- [x] `kairos-mind-tutor` proxy — holds `ANTHROPIC_API_KEY` server-side, rate-limited to 30 messages/user/hour via `ai_tutor_requests`.
- [x] Transactional email (application received / interview scheduled / approved / rejected) — `notify-application-email` + `instructor-approval` (needs a `RESEND_API_KEY` set to actually send).

**DO-5 · Auth hardening**
- [x] Require email confirmation; set password policy — configured in `supabase/config.toml` (`enable_confirmations`, `minimum_password_length = 8`, `password_requirements`) and pushed to the live project with `supabase config push --project-ref hzcdcjtngxhxbzeirbmz`. Correction to an earlier note here: this **does** reach the hosted project via the Management API — a prior version of this README said `config.toml` only governs local `supabase start`, which turned out to be wrong; I just hadn't tried `config push` yet. Verified: `supabase config push` reports `auth: up_to_date` against the live project.
  - Caught two real bugs in `config.toml` while doing this that would otherwise have shipped straight to production: `site_url` was still `http://localhost:5173` (every confirmation/password-reset email would have linked to localhost) and `additional_redirect_urls` pointed at `https://slearn.vercel.app`, a domain that doesn't exist — the actual Vercel project (`store-s/s-learn`) serves production from `s-learn-beta.vercel.app`, confirmed via `vercel alias ls`. Fixed both, plus added the two other stable production aliases and a wildcard (`https://s-learn-*-store-s.vercel.app/**`) covering per-PR preview deployments, which get a random-hash subdomain each time.
  - Also found `[storage.vector].enabled = true` in `config.toml` (a `supabase init` default, predating this session) blocking the push entirely with a 402 — vector buckets need a paid plan this project doesn't have. Set to `false` to match the project's actual tier; nothing in this app uses it.
- [x] Profile creation moved server-side (`on_auth_user_created` trigger, `0005_auth_hardening.sql`) — required once email confirmation is on, since `signUp()` returns with no session until the link is clicked, and the old client-side profile insert needed one.
- [x] Remove the client's ability to self-assign `instructor` at sign-up.

**DO-6 · Observability & resilience**
- [x] Scheduled jobs (`pg_cron`) and a retry-safe notification queue (`pgmq`), added via Supabase's Cron/Queues integrations — `0010`–`0013`.
  - `expire-stale-payments` (hourly): `payments` rows left `pending` past Stripe Checkout's 24h session expiry get marked `failed` — otherwise an abandoned checkout just sits as an ambiguous row forever.
  - `prune-ai-tutor-requests` (daily 03:00): deletes `ai_tutor_requests` rows older than 7 days — nothing reads past the trailing 1-hour rate-limit window, so they were dead weight.
  - `notify_application_submitted`/`notify_interview_scheduled` no longer call `net.http_post` directly from the trigger (fire-and-forget, no retry — a transient failure used to just drop the email silently). They now enqueue onto a `pgmq` queue (`application_notifications`); `process-application-notifications` (every minute) dispatches and confirms delivery, retrying up to 6 times before archiving a message it truly can't deliver.
  - **Two real bugs found and fixed by actually running this against the live project, not just reading the code** (`0012`, `0013`): (1) the first version called `net.http_collect_response(request_id, async := false)` in the same transaction as the `net.http_post` that created the request — deadlocked forever, since pg_net's background worker can't see the queued request until that transaction commits. Caught a backend stuck in `PgSleep` for 60+ seconds and had to `pg_terminate_backend` it. Fixed by splitting dispatch and outcome-confirmation across separate cron runs (a `notification_dispatch` tracking table), so the confirmation check is a plain `SELECT` against already-committed data, never a blocking wait. (2) The fixed version still silently misbehaved: `net.http_response` (a 3-field composite type meant for `http_collect_response`'s return value) and `net._http_response` (the actual 8-column response table) don't share a column layout — `select * into` a composite variable matched by position, not name, so `resp.status_code` actually held the row's `id`. A real 200 response was dispatched and confirmed-received, but the message never got deleted because the row's `id` (e.g. `4`) isn't between 200 and 299. Fixed by selecting the one needed column by name into a plain `int` instead of a composite variable. Verified end-to-end afterward: enqueued a test message, watched it dispatch, get a real 200 back, and get deleted from the queue on the next run.
- [x] Error tracking + basic uptime monitoring.
  - Frontend: `@sentry/react`, wired in `main.tsx` + `lib/errorTracking.ts`. Complete no-op — the SDK isn't even downloaded — unless `VITE_SENTRY_DSN` is set. A small dependency-free `AppErrorBoundary` always catches render errors and shows `components/ErrorFallback.tsx`, regardless of whether Sentry is configured; reporting is a side effect, not a requirement.
  - Uptime: `supabase/functions/health` — a public, unauthenticated endpoint that runs one cheap query to confirm the DB is reachable, for any external monitor (UptimeRobot, Better Uptime, Checkly, ...) to poll. Point it at `https://<project-ref>.functions.supabase.co/health`; alert on non-200 or `status !== "ok"`. Creating the actual monitor account is on you — I can't provision third-party services.
  - What's *not* done: edge-function-side error reporting (the three existing functions still just return 500s on unexpected failure, not forwarded anywhere) — would need a Deno-compatible Sentry client; skipped for now rather than half-build it.
- [x] Automated Postgres backups + a tested restore.
  - `scripts/db-backup.sh` (`pg_dump --format=custom`) and `scripts/db-restore.sh` (`pg_restore`, destructive, requires typed confirmation). `.github/workflows/backup.yml` runs the backup daily via cron against `secrets.DATABASE_URL`, uploading the dump as a 90-day workflow artifact.
  - **Actually tested**, not just written: ran a full drill locally — seeded a database via the real migrations, inserted a marker row, ran the backup script, restored into an empty database, and confirmed all 16 tables, RLS flags, the auth trigger, and the marker row survived intact.
  - What's *not* done: Supabase's own managed scheduled backups (a dashboard/plan toggle, not code) and pushing the artifact to long-term storage (S3/R2/GCS) instead of GitHub's 90-day retention — noted as a follow-up in the workflow file.
- [x] Product analytics on the enrolment & apply-to-teach funnels.
  - `posthog-js`, wired the same no-op-until-configured way as Sentry (`VITE_POSTHOG_KEY`, `lib/analytics.ts`). Events: `signed_up`, `signed_in`, `course_enrolled` (guest + real), `lesson_completed` (guest + real), `instructor_application_started`, `instructor_application_submitted`, `instructor_application_decided`. Users are identified by Supabase user id; `resetAnalytics()` clears identity on sign-out.
  - What's *not* done: server-side capture for the `instructor_application_decided` event when the decision happens outside a page load (currently fires when `VerificationPipeline` next renders with an approved/rejected status, not the instant `instructor-approval` runs) — real-time-enough for a funnel view, not event-perfect.

**DO-7 · Quality**
- [x] Accessibility pass — verified with real `axe-core` runs (`npm run test:a11y`, also in CI), not just eyeballing markup. Found and fixed real issues: unlabeled auth form inputs (`<label>` without `htmlFor`/`id` — visible text doesn't help screen readers without that association), duplicate landmark labels, a heading-order jump, and several icon-only buttons with no accessible name or a hit target under 44px. Current state: 0 axe violations across Home/Courses/Auth-modal; all fixed touch targets are ≥44px.
- [x] Lighthouse budget — `lighthouserc.json` + CI job asserting accessibility ≥0.95, best-practices ≥0.9, SEO ≥0.9 (all real, verified locally: 100/96/100). **Performance is collected but not gated** — without a live Supabase backend, every failed API call retries for the full trace window and dominates every timing metric (confirmed directly: pointing the placeholder backend at a fast-failing closed port made scores *worse* than a slow-DNS placeholder, which only makes sense as a retry-storm artifact, not real page cost). Re-run against a real backend + real course data before trusting the performance number. Also code-split the instructor/lesson/certificate routes (`React.lazy`), added `vite-plugin-pwa` for an offline-capable app shell (real manifest + service worker, verified in a production build), and fixed a live bug found along the way: the hero banner referenced a nonexistent `/banner-p.png` (only `banner-l.png`/`banner-r.png` exist) — every guest's first paint was silently requesting a 404.

---

## 7. Priority treatment

| Pri | Item | Why |
|---|---|---|
| **P0 — Blocker / security** | RLS on every table; private credentials bucket; secrets out of git; require email confirmation; **stop instant instructor role** (gate behind verification) | Data exposure & fraud risk; nothing else ships safely without these |
| **P1 — Core to launch** | DB migrations; CI/CD; production hosting + env config; instructor-verification backend (application → interview → approval) | Required for a real, deployable, trustworthy product |
| **P2 — Key experience** | Kairos Mind AI-tutor proxy; guest-mode rules; single-role enforcement in UI; monitoring, backups, transactional email | Differentiators + operability once the core is live |
| **P3 — Enhancements** | Analytics, i18n (English/French), PWA offline, localized currency (Longrich `LR_CURRENCY`), reviewer/admin console polish | Growth & market fit; safe to defer |

**Suggested sequence:** P0 security → P1 migrations + CI/CD + hosting → P1 verification backend → P2 AI tutor + role/guest rules → P2 ops → P3.

---

## 8. Prototype reference

The interactive spec for everything above lives in **`SLearn Platform.dc.html`**: guest welcome with free courses and session-only achievements, the instructor application wizard, the verification pipeline (with the compulsory interview), and the separated student/instructor apps. Build the React features to match it.

---

## 9. Deployment (Vercel)

This repo is connected to Vercel — pushes to `main` deploy to production, and every PR gets an automatic preview deployment with its URL commented on the PR. `vercel.json` sets the build command, adds a SPA rewrite (defensive — this app's own routing is hash-based and doesn't strictly need it, but Supabase auth redirects and any future real-path routes will), and sets baseline security headers.

**Env vars to set in the Vercel project (Settings → Environment Variables):**

| Variable | Environments | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | Production, Preview | Safe to expose — it's the public API URL. |
| `VITE_SUPABASE_ANON_KEY` | Production, Preview | Safe to expose — RLS is what actually protects data, not this key. |

**Do not add to Vercel:** `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `NOTIFY_WEBHOOK_SECRET`. This is a static Vite SPA — nothing in the deployed bundle runs server-side code, so these have no legitimate use here and would just be sitting in a dashboard unnecessarily. They belong on the Supabase project instead:

```bash
supabase secrets set ANTHROPIC_API_KEY=...   # powers Kairos Mind
supabase secrets set RESEND_API_KEY=...
supabase secrets set NOTIFY_WEBHOOK_SECRET=...
# SUPABASE_SERVICE_ROLE_KEY / SUPABASE_URL are already injected into every
# edge function automatically — no need to set them yourself.
```

**Per-environment Supabase projects (optional but recommended before real users):** right now Preview and Production likely point at the same Supabase project. Once there's real user data, create a second ("staging") Supabase project, apply the same migrations to it, and set Preview's `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` in Vercel to point there instead — so PR previews can't touch production data.

**Custom domain + HTTPS:** Vercel → Project → Settings → Domains → add the domain, then point its DNS at Vercel (an `A`/`ALIAS` record for an apex domain, or a `CNAME` for a subdomain, per Vercel's on-screen instructions). HTTPS is provisioned automatically once DNS resolves — no separate certificate step.

**One remaining manual step:** GitHub → repo Settings → Branches → branch protection rule on `main` → enable "Require status checks to pass before merging" and select the `frontend`, `edge-functions`, and `database` checks from `.github/workflows/ci.yml`. That's what actually makes CI "block merge on failure" — a workflow file alone doesn't enforce it.
