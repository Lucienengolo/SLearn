# TODOS

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
