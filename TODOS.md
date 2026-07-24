# TODOS

## S@Learn Classroom — centralized learner management (2026-07-24)

Founder wanted a SECOND, separate page alongside (not instead of) the per-course
`CourseStudents.tsx` classroom: a centralized "S@Learn Classroom" aggregating learners
across every course the instructor teaches, matching the Slearn classroom.png layout
exactly again. Shipped as `SLearnClassroom.tsx`, reached via a new "S@Learn Classroom" tab
in `InstructorDashboard.tsx` (alongside Courses/Tutor Matches — the tab-bar row was
duplicated twice already, so extracted a small shared `TabNav` while adding the third).

- **Data layer** (`lib/instructorLearners.ts`) — separated into pure, unit-tested functions
  (`buildLearnerRows`, `computeCourseProgressBars`) plus an orchestrating fetch, unlike
  `CourseStudents.tsx`'s inline logic — the multi-course aggregation (staleness/certificates
  keyed per `student:course` pair, not globally per student, so one student in 2 courses
  gets independent reads) was complex enough to be worth locking down with tests.
- **Class Overall Progress chart** — one bar per course, ALL the same hue (not N distinct
  categorical colors): a variable, potentially large course count would force a fixed
  palette to cycle and repeat hues, which the dataviz non-negotiables forbid. Each bar is
  already directly labeled by course title, so color-as-identity isn't needed anyway.
- **Add Student** — reused by extending `AddStudentModal` to accept a course list instead
  of a single id (task before this: `CourseStudents.tsx` passes its one course; this page
  passes all of them, rendering a real `<select>` when there's more than one).
- Colors: unchanged, same app palette as everywhere else this session.

## Classroom student-management page (2026-07-24)

Founder: use `Slearn classroom.png` for real this time — exact layout, for student
management, added to the instructor dashboard, keeping S@Learn's own colors. Rebuilt
`CourseStudents.tsx` (the page a course's "Students" button already opens) to match the
reference precisely rather than just borrowing individual patterns from it as before:

- **Icon rail** (left, matches the reference exactly) — 3 real, functional icons:
  Dashboard (back), Classroom (current page, active state), Edit course (jumps straight
  into `CourseEditor` — new `onEditCourse` prop threaded through `InstructorDashboard.tsx`).
- **Information panel** — level, enrolled count, published date (all real `Course` fields;
  the reference's date-range field doesn't exist in this schema, so it's honestly omitted
  rather than faked).
- **Attention panel** — kept from the 2026-07-23 pass, now always visible (shows a neutral
  "nothing needs attention" message instead of disappearing, matching the reference's
  layout more literally).
- **2x2 stat tiles** — real numbers only, no fabricated "hours spent"/"challenges solved":
  course length, students completed, quiz attempts (new query), certificates earned.
- **Class Overall Progress chart** — kept from 2026-07-23, repositioned into the 3-column
  layout.
- **"Add Student" — built for real, not decorative.** The reference's button implied real
  functionality; unlike "Assign Products/Goals" (omitted again — no such concept exists in
  this product), manually enrolling a student is a genuine, buildable feature (real use
  case: payment settled outside Stripe). Required a new RLS policy
  (`0037_instructor_manual_enrollment.sql`) scoped to courses the instructor owns and
  student-role profiles only — verified locally against 3 cases (own course succeeds,
  someone else's course rejected, non-student profile rejected), including catching a real
  test-setup gotcha along the way: a security trigger (`0007_rls_performance_and_security_
  hardening.sql`) silently reverts `role`/`verified`/`is_reviewer` changes unless
  `auth.role() = 'service_role'`, which the first test attempt didn't set. **Not yet
  deployed** — same gap as migrations 0034-0036.
- Colors: unchanged from the app's existing gold/green/gray palette throughout — no green
  or other accent borrowed from W3Schools' actual branding.

## CI red on main (2026-07-23) — fixed

Founder reported 4 failing checks after this session's work landed on `main`: CI's
"Lint, typecheck, build", "Accessibility (axe-core)", "Lighthouse budget", and the Vercel
deploy. All 4 shared one root cause, confirmed by reading `vercel.json` and `.github/
workflows/ci.yml`: every one of them runs `npm run build` (`tsc -b && vite build`), and
that failed because `Profile.totem` was added as a *required* field but two pre-existing
test mocks (`tests/Chat.test.tsx`, `tests/PaymentStatus.test.tsx`) never got a `totem` field
added to them. Fixed by adding `totem: null` to both.

**Process gap that let this ship:** throughout this session I verified type safety with a
bare `npx tsc --noEmit`, which silently checked *zero files* (the root `tsconfig.json` has
`"files": []` and is reference-only — without `-b` it doesn't follow references). The real
check is `npm run typecheck` (`tsc -b --noEmit`), which follows into `tsconfig.app.json`
(includes `tests/`) and would have caught this immediately. Going forward, use
`npm run typecheck` and `npm run build`, not a bare `tsc` invocation.

Also fixed while investigating: `AudienceNav.tsx`'s inactive-tab text
(`text-warm-gray` on `bg-paper`) measures ~3.4:1 contrast by manual WCAG math — below the
4.5:1 AA floor for 11px text, and this nav is present on every page the axe-core/Lighthouse
jobs actually audit (Home, Courses list, Auth modal). Switched both states to `text-ink`,
differentiated by weight + underline instead of color. **Could not run the real axe-core
or Lighthouse audits locally to fully confirm** — this sandbox's headless Chromium hangs
under its persistent memory ceiling (same constraint documented earlier for the `browse`
tool and the mobile audit). Verified instead: `npm run typecheck`, `npm run lint`,
`npm run build`, and the full test suite (138/138) all pass locally.

## Founder Review Feedback (2026-07-22) — Priority List

10 items from a full review of the session's work. Ordered by actual severity/dependency,
not the order raised. P0 = broken right now, fix before anything else. P1 = real corrections
to what was just built. P2 = genuine new initiatives, each needs its own scoping pass before
code. P3 = explicitly "let's talk first," not a build item.

### P0 — Broken right now

- [x] **Tutor never notified of a new match.** Fixed in code
  (`match-tutor-request/index.ts`): a successful match previously notified nobody — only
  the zero-match staff-alert path inserted a notification. Added a notification insert to
  the tutor on every successful assignment. **Not live yet** — see the deploy blocker below.
- [x] **Live selfie camera capture silently does nothing.** Real bug, not a permissions
  issue: `IdentityCapture.tsx`'s `openCamera()` set `cameraOpen=true` then used a single
  `requestAnimationFrame` to attach the stream to the `<video>` ref — but that element only
  exists in the DOM once `cameraOpen` is true, and a RAF firing before vs. after React's own
  commit isn't guaranteed. Permission would show as granted, stream acquired, and then
  nothing displays. Fixed with `useEffect(() => {...}, [cameraOpen])`, which React
  guarantees runs after the DOM commits — no more race.
- [ ] **P0 — Edge functions were never deployed to the live project.** `supabase db push`
  (this session) only pushed the 4 SQL migrations — `match-tutor-request`,
  `create-tutor-deposit-checkout`, `cancel-tutor-booking`, and the modified
  `stripe-webhook` were never deployed (confirmed: the new function 404s live, an existing
  one 400s). Deploying functions needs a Management API credential (`supabase login` or a
  `SUPABASE_ACCESS_TOKEN`), which is a different credential than the DB connection string
  already used — nothing in this session has it. Until this deploys, the schema exists but
  none of the actual matching/payment/notification logic runs. **Blocks the notification
  fix above from taking effect, and blocks the entire tutor marketplace from working
  end-to-end.**

### P1 — Real corrections to what was just built

- [x] **Tutor profile setup form should not duplicate V2 verification data.** Resolved
  per founder's direction (not the compromise originally proposed): the genuinely-missing
  fields (subjects to tutor, neighborhood, teaching mode, languages, rate, response time,
  tutoring WhatsApp) are now collected as an optional "Tutoring" step directly inside
  `ApplicationWizard.tsx` (V2's own form), with an explicit notice that this data drives
  automated parent-matching and should be filled in accurately. `instructor-approval`
  auto-populates `tutor_profile_fields`/`tutor_subjects` from this at approval time — no
  second form gate. Verified end-to-end against real Postgres (seed → simulate approval →
  confirm both tables populate correctly). `TutorProfileForm.tsx` (T11) is kept, but now
  only as an edit-later tool or an opt-in path for an instructor who skipped this step.
- [x] **Account type should not be a visible label for students; instructor status should
  be a real trust signal.** `Header.tsx`'s raw `profile.role` badge (shown to the account
  owner) is gone for students entirely; replaced with a "Verified instructor" badge shown
  only when `role === 'instructor' && verified === true`. The *public*-facing version of
  this signal (on course cards/instructor bylines, visible to other users) is still open —
  noted below.
- [x] **Public verified-instructor badge on course cards/byline.** `CourseCard.tsx` (used
  by `HomePage.tsx` and `CourseList.tsx`) now shows a small checkmark next to a verified
  instructor's name; `CourseDetail.tsx`'s instructor byline shows a "Verified" pill. Both
  read `profiles.verified` via the existing `instructor:profiles!instructor_id(...)`
  embedded query (already publicly readable, no RLS change needed) — just added `verified`
  to the select list in 3 call sites. Verified with real seeded data (`Lucien Engolo`,
  `verified: true` in the live DB) via direct REST query; a live screenshot wasn't possible
  this pass due to this sandbox's persistent memory pressure (see note below), so this
  relies on the passing component tests (`CourseCard.test.tsx`) plus reusing the exact
  `bg-green-50 text-green-700` pattern already proven elsewhere in this codebase.
- **Parent tutor-request form is too minimalist to capture what parents actually need.**
  Current fields (subject, grade, neighborhood, budget, WhatsApp, child label) don't
  capture specificity a parent might care about (learning goals, urgency, schedule
  constraints, tutor preferences). Needs a real design pass on what fields actually matter
  before adding them — not just padding the form.
- **Bilingual toggle doesn't cover the whole platform.** Scoped deliberately to platform
  chrome only for T9 (Header nav) — this was the stated scope at the time, not an oversight,
  but the founder now wants full-platform coverage. Translating every string across V1's
  existing pages (courses, lessons, dashboards, account settings) plus the tutor-marketplace
  screens is a real, large undertaking — needs a scoped inventory of what to translate first
  and in what order, not a blind pass.
- [x] **Mobile responsive quality across the app is poor.** Audit done as a code-level
  review (a live-screenshot pass wasn't possible this session — the browser tool
  consistently failed to start under this sandbox's persistent memory ceiling, ~50-60Mi
  free regardless of cleanup, most likely VS Code + extensions, not anything spawned by
  this work). Systematically checked layout classes across `HomePage.tsx`, `CourseList.tsx`,
  `CourseDetail.tsx`, `LessonViewer.tsx`, `InstructorDashboard.tsx`, `CourseStudents.tsx`,
  `QuizViewer.tsx`, and every Tutors/ component + `ApplicationWizard.tsx` built this session.
  **2 real, concrete bugs found and fixed, both introduced this session:**
  1. `LessonViewer.tsx`'s header row grew to 3 text-bearing elements (back link + the new
     low-bandwidth toggle + Kairos Mind toggle) with no `flex-wrap` — their combined width
     exceeds a phone viewport. Fixed: added `flex-wrap` + `gap-y-2`.
  2. `RequestForm.tsx`'s budget min/max inputs were `w-full` siblings in a flex row with no
     `min-w-0` — number inputs have a browser-default intrinsic minimum width that flexbox
     respects unless overridden, so the pair would refuse to shrink and overflow. Fixed:
     added `min-w-0` to both.
  **Checked and judged low-risk, not fixed:** `InstructorDashboard.tsx`/`CourseStudents.tsx`'s
  3-column stat grids (short numeric content in fixed grid cells, not the same overflow
  class as the two bugs above). **Not yet audited:** Account Settings, Auth modal,
  Certificates page, Kairos Mind panel, Review Queue, Course Editor/Quiz Builder (instructor
  authoring tools) — this pass covered the highest-traffic pages plus everything built this
  session, not the entire app exhaustively.

### P2 — New initiatives (each needs its own scoping pass, not a direct build)

- **Tutor course/lesson creation is still minimalist.** Overlaps directly with the
  already-logged "Course & lesson restructuring" item below (Module → Lesson → Section
  hierarchy, sync/async lesson types) — same initiative, not a new one. See that section.
- [x] **Multi-audience nav + institutional landing pages** (Individual | School & University
  | Business | Government). Founder shared Coursera/W3Schools reference screenshots
  (2026-07-23); resolved via `/design-consultation` as "adopt the UX structure, re-skin
  entirely in the existing ink-and-paper system" — see DESIGN.md's new "Patterns" section.
  Deliberately scoped to NOT touch `profiles.role` or RLS: the 3 new tabs route to static
  marketing/interest-capture pages (`InstitutionalLandingPage.tsx`, one component
  parameterized by account type), not real new account types with auth/dashboards — that
  remains its own initiative below, unchanged. Inquiries land in a new
  `institutional_inquiries` table (`0035_institutional_inquiries.sql`, public insert +
  reviewer-only select, verified against local Postgres including an RLS rejection test for
  empty fields). `AudienceNav.tsx` added above `Header.tsx`'s main row. **Migration written,
  verified locally — not yet deployed to the live Supabase project** (same deploy gap as the
  P0 edge-functions item above; this one is just a SQL migration though, so it can go out
  with the next `supabase db push` once a session has DB credentials).
- **Real new account types (University, Business, Government profiles) with their own
  auth/dashboards** — NOT what was just built above (that's marketing pages only). Still
  needs its own `/office-hours` or `/spec` pass: `profiles.role` is a DB-enforced CHECK
  constraint limited to `'student'`/`'instructor'` (`0003_single_role_enforcement.sql`),
  and adding real account types touches that constraint, every RLS policy keyed on `role`,
  and per-account-type dashboards. Only start this once there's real inquiry volume from the
  pages above to justify it.
- [x] **Gamification (streaks / XP / credits + personal tier)** — shipped as a
  `StreakXPCard` on `StudentDashboard.tsx`, entirely derived from existing
  `lesson_progress`/`quiz_attempts` rows (`lib/gamification.ts`), no new migration, no new
  deploy dependency. Scoping calls made: 10 XP/completed lesson, 15 XP/distinct passed quiz
  (deduped by quiz_id so retrying an already-passed quiz doesn't farm XP), streak = 
  consecutive calendar days with a completion or quiz attempt (grace through end-of-day if
  today has no activity yet), tier = Bronze/Silver/Gold by XP threshold. Deliberately NOT a
  competitive leaderboard — comparing/ranking against other students needs a privacy
  decision plus a cron-driven weekly reset (same shape of work as the tutor-matching cron
  jobs); this is personal-only. Styled per DESIGN.md Patterns (square Oxblood ticks, plain
  IBM Plex Mono XP number, typographic tier label). Applies to students only for now — the
  same pattern would need separate tutor-facing metrics (sessions taught, not XP) if
  extended to tutors later.
- [x] **Pathfinder-style dashboard sidebar IA.** Founder confirmed to proceed. Shipped as
  `DashboardSidebar.tsx`: Dashboard / My Requests / Certificates / Profile, wired into
  `StudentDashboard.tsx` (220px sidebar + fluid main column, per DESIGN.md's Layout token).
  Deliberately just shortcuts to the SAME existing top-level pages/routes (not a duplicated
  IA) — no "My Progress" tab added, since `StudentDashboard` itself already IS the progress
  view (stats + streak/XP + course list); a separate identical destination would be a dead
  click, not a real feature.
- [x] **Instructor "classroom" adaptation** (founder: "look at Slearn classroom.png and
  adapt my instructor page"). Adapted `CourseStudents.tsx` (the actual per-course page that
  maps to that reference, not the multi-course list): added an "Attention" panel (students
  who haven't started + students inactive 14+ days, computed from real `lesson_progress`
  timestamps, not a stored field), a "Class overall progress" bar chart (Not started / In
  progress / Completed counts, reusing the same status buckets `statusBadge` already used),
  and a "Needs attention"/"Last active" signal per student row. Styled in the page's existing
  gray/primary token system, not ink-and-paper, to stay consistent within one already-cohesive
  screen (same reasoning as the audience-nav vs. institutional-page token choice). Did NOT
  add "Assign Products"/"Assign Goals" buttons from the reference — no backend concept of
  "goals" exists; that's part of the already-deferred LMS/class-management initiative below,
  not something to fake here.
- [x] **Avatar identity system ("totems").** Founder request: avatars should reference
  African national-team totem names (e.g. Indomitable Lions). First pass shipped text-only;
  founder corrected — wanted an actual mascot, not plain text. Revised to an emoji-glyph
  badge (colored circle + animal/symbol emoji, e.g. 🦁 for the 3 lion-nickname totems,
  distinguished from each other by badge color) since no image-generation capability exists
  in this environment and no real team crests/logos are used (trademarked assets) — 10 real,
  public team nicknames (`lib/totems.ts`), a `profiles.totem` column with a matching CHECK
  constraint (`0036_profile_totem.sql`, verified locally — not yet deployed, same gap as 0035
  above), a mascot-badge picker in Account Settings, and the badge + totem name shown on the
  student dashboard greeting. **Real bug caught while wiring this up:** `lib/totems.ts` holds
  Tailwind class strings as plain data (not JSX), but `tailwind.config.js`'s `content` glob
  only scanned `components/**/*.{ts,tsx}` — the badge colors would have compiled to nothing
  in production. Fixed by adding `./lib/**/*.ts` to the glob.
- [x] **New marketing landing page.** Founder flagged this gap twice (2026-07-22, then again
  2026-07-24 as "there is no landing page"). IA decision resolved via AskUserQuestion: `/`
  shows the new `LandingPage.tsx` for logged-out visitors only; signed-in users still land on
  the existing course-browsing `HomePage.tsx` unchanged (`App.tsx`'s `home` route now
  branches on `user`). Content: hero + CTAs, trust stats, 3 real product pillars (courses /
  tutor marketplace / certificates), **real student reviews as testimonials** (pulled from
  the `reviews` table, rating ≥ 4 with a comment — the section omits itself if there aren't
  any yet, rather than shipping fabricated quotes), a vision statement, a final CTA, and a
  minimal footer (the app had none anywhere before this). `AuthModal` gained an `initialMode`
  prop so the landing page's "Get started" CTA opens straight into signup, not login —
  required lifting `authModalOpen`/`authModalMode` state from `Header.tsx` up to `App.tsx`
  so both components can trigger the same modal.
- [x] **Replaced `alert()`/`confirm()` with in-app UI** (founder: "not modern... standard of
  app building" — a concrete, non-aesthetic instance of that). Native dialogs freeze the tab
  and don't match the app's own styling. Added `ToastProvider`/`useToast()`
  (`contexts/ToastContext.tsx`, wraps the app in `App.tsx`) and `ConfirmDialog`
  (`components/UI/ConfirmDialog.tsx`), then replaced all 6 call sites: 3 `alert()`s in
  `CourseDetail.tsx` → `showToast(..., 'error')`; `InstructorDashboard.tsx`'s delete-course
  `confirm()` → `ConfirmDialog` with a real destructive-action state machine, and its 2
  `alert()`s → toasts.

### P3 — Discussion needed first, not a build item yet

- **Regulatory & compliance.** Founder wants to discuss this, not receive an implementation.
  Real candidate topics once that conversation happens: data protection (Cameroon/CEMAC
  context), KYC/identity-verification legal obligations for the instructor pipeline,
  holding parent deposits (payment services regulation), and the certificate-issuance trust
  model in the deferred LMS initiative below.
- **Optimization/performance setups.** Also explicitly a conversation, not a build item —
  needs a target (what's actually slow, for whom, measured how) before any work is scoped.

## Deferred: Tutor-Marketplace MVP Design Debt (from `/plan-design-review`, 2026-07-21)

- **P3 — Document a named component vocabulary in DESIGN.md.** Button variants
  (primary/secondary/decline), the verification stamp, the status-track stepper, and
  chat bubbles were specified for the first time in this review's wireframe
  (`~/.gstack/projects/Lucienengolo-SLearn/designs/tutor-mvp-screens-20260721/`).
  DESIGN.md currently only has tokens (color/type/spacing), not named reusable
  components — without documenting these now, future screens risk reinventing them
  ad hoc. Cheap (~30min), no dependency.
- **P2 — Produce actual English translations for tutor-marketplace screen copy.**
  The bilingual toggle (T9) builds the mechanism, but all copy in the reviewed
  wireframe (form labels, "still looking" messaging, decline-reason chips,
  cancellation policy text) is French-only. Needs a fluent speaker, not machine
  translation, given trust-sensitive booking/payment copy. Depends on T9's toggle
  existing to render into; without this, T9 ships a toggle with nothing behind it.

## Deferred: Tutor-Marketplace MVP Might-Have Items

Logged 2026-07-20 from the `/plan-ceo-review` of the tutor-marketplace MVP
(`~/.gstack/projects/Lucienengolo-SLearn/ceo-plans/2026-07-20-tutor-marketplace-mvp.md`).

- **P2 — Mobile money (MTN/Orange Money) integration, both payout and deposit-collection
  aggregator.** Deferred because telco business-account approval has an unpredictable lead
  time outside anyone's control. Founder's stated plan: pursue a mobile-money payment
  aggregator (not direct telco integration) once approval/setup is available, so this
  doesn't block the MVP launching on Stripe/card first. Depends on: aggregator selection
  and business account setup (external, not a CC task).
- **P3 — One-paper credibility badge on tutor profiles.** A thin record (paper URL +
  verified_at + verified_by), populated via webhook FROM the separate V3 exam-paper SaaS
  once that product exists and verifies a solution. Blocked entirely on V3 having its own
  build timeline — do not build the S@Learn-side webhook receiver until V3's outbound
  webhook contract is defined. When built, needs webhook signature verification and
  replay/idempotency protection (the one integration point exposed to an external system).
- **P3 — Session scheduling calendar / recurring bookings / tutoring-specific reviews.**
  Noted as lower-priority candidates during the MVP's cherry-pick ceremony, not individually
  scoped. Revisit once the MVP's manual "confirm session date in chat" mechanism (see the
  CEO plan's item 5b) proves insufficient at real volume.

## Deferred Initiative: LMS & Certification Overhaul (separate track from the tutor-marketplace MVP)

Logged 2026-07-20 from a team-member product spec, pasted during `/plan-ceo-review` of the
tutor-marketplace MVP. Explicitly NOT part of that MVP's scope — parked here as its own
future initiative per the founder's decision to run both as parallel tracks. Needs its own
`/office-hours` or `/spec` pass before any of this gets built; nothing below is scoped or committed.

### Instructor profiles (V1 course-marketplace scope)
- Photo, name, headline, bio/teaching philosophy, credentials (degrees/institutions/years)
- Rating + review count aggregation
- Full course list filterable by level (GCE/BEPC/University), subject, price
- Response time / availability indicator

### Course & lesson restructuring (V1 architecture change)
- Course → Module → Lesson → Section hierarchy (sections: video, PDF/slides, rich text,
  downloadable resource, embedded quiz)
- Per-lesson progress checklist (not just course-level percentage)
- Both synchronous (scheduled/Zoom) and asynchronous (self-paced) lesson types in one course

### Decentralized certification model (major trust-model change, V1)
- Each instructor issues their own certificate (their name/logo/wording), platform sets
  minimum-standard requirements and does NOT issue certificates itself
- Public certificate verification page via unique code/QR
- **Confirmed by founder (this doc, not yet reviewed by CC):** verification is admin-gated —
  requester submits a code via a public form (no login), request lands in an admin queue,
  admin approves before the result is released to the requester (email or one-time link).
  Needs rate-limiting/abuse protection on the public submission form.
- Platform can revoke recognition from an instructor (fraud/fake completions), which
  retroactively devalues certificates they've issued

### Assessment & Kairos Mind integration
- Simulation/case-based question types per subject (science scenario problems, business
  case studies, language situational dialogue) beyond MCQ/true-false/short-answer
- Kairos Mind generates personalized follow-up questions on wrong answers, explains why an
  answer is wrong (not just marking incorrect)
- Per-quiz passing thresholds; instructor choice of whether a quiz gates progression
- **Confirmed by founder:** Kairos Mind is platform-wide and context-aware (knows the
  current lesson/course), not a separate AI instance per subject — already roughly matches
  the existing `KairosMindTutor.tsx` implementation; needs verification against actual
  current behavior before treating this as a gap.

### Instructor class-management tools
- Announcements (course-wide or tagged sub-group)
- Assignments (due date, description, file-upload requirement; student self-marks-done,
  instructor confirms/grades)
- Two-way comments/discussion on assignments and lessons
- Zoom/live-session links attached to lessons or scheduled standalone, with calendar view
- Student tagging/grouping (e.g. "2026 GCE cohort," "Needs extra support")
- Assignment status dashboard (submitted / late / complete)

### In-person tutor booking & split payment (overlaps with tutor-marketplace MVP —
### reconcile scope before building either)
- **Confirmed by founder:** platform handles in-person booking directly, with either full
  online payment or a partial deposit online + remainder paid in person/mobile money on-site
- Needs: booking/scheduling calendar for in-person slots, split-payment logic
  (deposit vs. balance), instructor manual confirmation that the balance was received
  (marks booking "fully settled")
- **Flag:** this materially overlaps with the tutor-marketplace MVP's payment scope
  (see main MVP plan) — needs explicit reconciliation before implementation, not two
  independent payment systems for the same underlying "book and pay a tutor" flow.

### Platform-wide, cross-cutting (candidates worth re-evaluating against the tutor-MVP
### Might/May list too, since they fit the African-market thesis directly)
- Low-bandwidth mode: video quality auto-adjust, audio-only/PDF-first fallback
- Bilingual UI toggle (French/English) for platform chrome, not just course content
- Course discovery filters: instructor, subject, level, price, teaching mode, language
- Instructor payout dashboard: earnings, pending payments, mobile money (MTN/Orange) rails
- Push + SMS notification fallback (email alone unreliable for target users)
- Free course preview (sample lesson before purchase)

### Admin/ops tooling decision (infrastructure choice, not a product feature)
- **Confirmed by founder:** trigger-only integration with Jira/Monday.com (instructor
  verification pipeline as tickets: interview → docs submitted → approved/rejected;
  flagged content/plagiarism disputes/certificate-verification requests auto-create
  tickets) and Slack (real-time ops alerts) — avoids building a custom internal admin UI.
  This is a real, reasonable build-vs-buy call once V2's verification volume justifies it,
  but it's an ops-tooling decision to make when there's real volume to manage, not before.
