# TODOS

## Beta-readiness roadmap, Batch 5: category management (add existed, delete didn't) (2026-08-01)

Founder: "add a clear option to add or delete a course category." Adding already existed (`CourseEditor.tsx`'s inline "+" chip, and `RequestForm.tsx`'s equivalent for parents); deleting had no path at all -- `categories` had a public SELECT policy and 2 INSERT policies, but no UPDATE or DELETE policy whatsoever, meaning every delete attempt was RLS-denied for every role, full stop.

`0045_instructors_delete_categories.sql` adds a DELETE policy scoped to **verified instructors only** (locked decision) -- matches the ORIGINAL, more conservative category-creation policy from before parents were allowed to create ad-hoc ones (0028 vs. the looser 0041), since deleting is more consequential than creating. There's no admin/moderator role anywhere in this app (`profiles.role` is a hard check constraint: only `'student'`/`'instructor'`), so this is the tightest scoping available without a bigger role-model change.

**Deleting isn't just an RLS question, though.** The 3 tables that reference `categories.id` behave differently on delete: `courses.category_id` is `ON DELETE SET NULL` (would silently blank a course's category -- no error, but not what anyone wants), `tutor_requests.category_id` has no `ON DELETE` clause (defaults to RESTRICT -- blocks with a raw, unfriendly Postgres FK error), and `tutor_subjects.category_id` is `ON DELETE CASCADE` (would silently delete a tutor's subject-matching rows). New `lib/categories.ts`'s `checkCategoryUsage()` queries all 3 tables' row counts for a category *before* attempting the delete, so the UI can show a clear "used by N courses/requests, remove it from those first" message instead of any of those three surprising behaviors.

New `components/Dashboard/ManageCategoriesModal.tsx` (a "Manage" button next to the existing category picker in `CourseEditor.tsx`, visible only to verified instructors -- hiding it from anyone who'd just hit the RLS wall) lists every category with a delete action, using the existing `ConfirmDialog` component (not a native `confirm()`) for the destructive-action confirmation, consistent with this app's established alert()/confirm()-replacement pattern.

Verified both directions of the RLS policy (blocked: unverified instructor, student; allowed: verified instructor) plus the `SET NULL`/cascade FK behaviors against the local `ci_test` stub before deploying. Full suite (354/354, up 9), typecheck clean.

## Beta-readiness roadmap, Batch 4: new-chat-message notifications (2026-08-01)

Founder: notify users of new messages on the tutor chat. `lib/matches.ts`'s `sendMessage()` inserts directly into `messages` as the authenticated sender -- `notifications`' own INSERT policy only allows a user to notify themselves (0023_notifications.sql), so a plain client-side insert can't notify the OTHER party in the conversation. `NotificationBell.tsx` (bell icon in `Header.tsx`) and the `notifications` table already existed and work (load-on-mount, mark-read) -- there was just never a trigger creating a notification for a new chat message specifically.

Added `0044_message_notifications.sql`: a `security definer` Postgres trigger on `messages` AFTER INSERT, running with the migration owner's privileges to bypass the self-only INSERT policy for this one narrow, server-controlled side effect -- the same pattern the existing edge functions already use via the service-role key, just expressed as a trigger since messages are inserted directly by the client with no edge function in that path. Resolves the recipient (whichever of the match's tutor or the request's parent is NOT the sender) and reuses the flat-page-string `link` convention already established by `match-tutor-request`'s own notification inserts (`'tutor-matches'` / `'my-requests'` -- `NotificationBell` doesn't support per-match deep links today). The notification insert is wrapped in its own exception handler so a notification failure can never roll back the actual chat message -- mirrors the existing edge functions' "log and continue" leniency around notifications.

**Local `ci_test` stub gap found and fixed along the way**: the stub was missing the `notifications` table entirely (0023_notifications.sql had never been applied to it, even though later migrations had) -- applied it before verifying this trigger. Also re-learned a subtlety from earlier sessions' RLS-testing notes: `auth.role()` reads `request.jwt.claim.role` (singular, dot-path), NOT the `request.jwt.claims` JSON blob used for `auth.uid()`-style claims elsewhere -- setting the wrong one silently no-ops trigger checks that gate on `auth.role() = 'service_role'` (like `profiles_set_updated_at()`'s role/verified guard) without raising an error, which briefly looked like the fixture setup itself was broken.

Verified both directions (tutor->parent, parent->tutor) end-to-end against `ci_test` with real fixture data before deploying; migration pushed to production. No client-side changes needed.

## Beta-readiness roadmap, Batch 2: payments disabled for V1 + FCFA currency migration (2026-08-01)

Founder decision (locked via AskUserQuestion during planning): local payment methods (Mobile Money) aren't integrated yet, and Stripe-in-USD isn't a good fit for this market either -- for V1, **both** course purchases and tutor deposit/balance payments switch to a "not available yet" message instead of real charging, while the payment buttons themselves stay visible (explicit founder instruction, not hidden/removed).

**Payment gate**: new `lib/paymentsConfig.ts` exports `PAYMENTS_ENABLED = false`. `CourseDetail.tsx`'s `handleEnroll()` and `PaymentStatus.tsx`'s `handlePayDeposit()` both check this flag before ever calling their respective edge functions (`create-checkout-session`, `createDepositCheckout`) -- when disabled, shows a new bilingual "coming soon" message instead. This is a **client-side gate only**: it stops the button from ever reaching the edge functions, but doesn't harden `create-checkout-session`/`create-tutor-deposit-checkout` themselves against a direct call bypassing the UI. Hardening those server-side is a real follow-up, not done here -- needs an edge-function redeploy this session doesn't have fresh Supabase deploy credentials for (the access token from an earlier session was explicitly a one-time paste the founder was advised to rotate).

**Currency migration**: `courses.price` was USD-style (e.g. 29.99), charged as real USD cents via Stripe's `create-checkout-session` (`currency: 'usd'`) -- unlike the tutor-marketplace deposit flow, which was already correctly `currency: 'xaf'`. Per the locked decision, `0043_courses_price_fcfa.sql` (deployed to production) multiplies every existing course price by ~600 (FCFA/$1) once; all future instructor input is FCFA directly, no more USD math. New `lib/currency.ts` (`formatFCFA`) replaces the hardcoded `$${price.toFixed(2)}` in `CourseCard.tsx` and `CourseDetail.tsx` (2 spots) with FCFA formatting, mirroring the `Intl.NumberFormat('fr-FR')` pattern already used in `PaymentStatus.tsx`. `CourseEditor.tsx`'s price input relabeled "Price (FCFA)" and changed from cent-precision (`step="0.01"`) to whole-FCFA (`step="1"`, `parseInt` instead of `parseFloat`).

Also fixed `supabase/functions/create-checkout-session/index.ts` to charge `currency: 'xaf'` (zero-decimal, matching the tutor-deposit function) instead of `usd`, so if/when V1's payment gate flips back on, it charges correctly instead of silently overcharging ~600x in the wrong currency. **This edge function change is committed but not yet deployed** (same credential gap as above) -- since `PAYMENTS_ENABLED` already blocks the client from reaching it, this is a non-urgent but real follow-up before payments are ever re-enabled.

Verified: full suite (345/345, up 5 -- new gate-behavior tests for both CourseDetail and PaymentStatus, kept the existing Stripe-mechanics test coverage alive by mocking `PAYMENTS_ENABLED: true` in `PaymentStatus.test.tsx` rather than deleting it), typecheck clean. Migration's `price * 600` math sanity-checked against the local `ci_test` stub (29.99 -> 17994).

## Beta-readiness roadmap, Batch 3: instructor avatar not showing on course page (2026-08-01)

Founder screenshot showed an instructor's course-detail card always rendering initials ("LE") instead of their real uploaded photo. Root cause: `CourseDetail.tsx`'s `fetchCourseData()` select query never asked for `instructor.avatar_url` at all (`instructor:profiles!instructor_id(full_name, bio, verified)`) -- the photo upload flow in `AccountSettings.tsx` (`lib/storage.ts`'s `uploadAvatar`) is real and working, but CourseDetail had no way to know it existed. Added `avatar_url` to the select and the `CourseWithRelations` type, and render the real photo with the same broken-image-fallback pattern established earlier this session (`onError` -> fall back to initials) instead of always showing initials.

Checked `CourseCard.tsx` (the course-list card) too, since the plan assumed it needed the same fix -- it doesn't: that component only ever renders the instructor's name as plain text, no avatar circle at all, so there was nothing to fix there. Fixed the one real bug (`CourseDetail.tsx`) rather than touching a file with no actual issue.

Verified: 3 new regression tests (real photo renders, falls back to initials on load failure, falls back to initials when no avatar_url exists at all) plus the full suite (343/343, up 3), typecheck clean.

## Beta-readiness roadmap, Batch 1: legal documents (2026-08-01)

Founder ran a personal app review ahead of the security/compliance/RLS pass gating beta testing and flagged 7 product/eng items plus a legal-documentation gap. Full 8-item prioritized roadmap planned via `/home/lucien/.claude/plans/mighty-booping-tiger.md` (plan-mode session, approved). This is Batch 1 of 7 -- highest priority, since research for the plan found Cameroon's Law No. 2024/017 (Personal Data Protection, enacted 23 Dec 2024) became enforceable/sanctionable on 23 June 2026, which has already passed. An app processing children's grades/neighborhoods/location and payment data without a compliant posture is exposed now, not just "should get to eventually."

Added 5 documents (`lib/legalDocs.ts`, bilingual EN/FR bodies): Terms of Service, Privacy Policy, DPA, Refund Policy, and an Instructor MSA + cyber-insurance scoping brief. Grounded in real Cameroonian statutes found via research: Law No. 2024/017 (data protection), Law No. 2010/021 (e-commerce), Law No. 2011/012 (consumer protection), Law No. 2010/012 (cybersecurity/cybercrime). **Every document carries a prominent disclaimer** (rendered once in `components/Legal/LegalDocument.tsx`, not duplicated per-doc): these are research-grounded first drafts, not a substitute for review by a licensed Cameroonian attorney before going live for real users. The cyber-insurance section is explicitly a scoping brief to hand to an actual insurer, not a policy -- this app can't issue insurance. The Instructor MSA does NOT invent a commission percentage (grepped the codebase -- no fee/commission logic exists anywhere), states "to be defined" instead, consistent with this project's no-fake-features principle.

In-app integration: new `/legal/*` pages reachable from a new "Legal" footer column (`Footer.tsx`, previously 3 columns + an explicit comment that Terms/Privacy links were deliberately omitted since none existed -- now updated since real ones do) and a required consent checkbox on the signup form (`AuthModal.tsx`) linking to the Terms and Privacy Policy, disabled-until-checked. The checkbox is plain English, not run through the FR/EN `t()` system -- `AuthModal.tsx` is entirely hardcoded English today (a known, separately-tracked i18n-sweep gap), so translating only the new checkbox would have been more inconsistent than matching the file's current state.

Verified: full suite (340/340, up 7), typecheck clean. Reused `lib/richText.tsx` (the existing markdown-lite renderer built for lesson content) for document formatting instead of a second rendering path, since the #/##/list structure it already handles covers what these documents need.

## ClassworkComposer's Assignment type pill overflowed the mobile screen (2026-07-31)

Founder: selecting "Assignment" in the Stream tab's post-type selector didn't fit on a mobile screen. Root cause: the 3-pill selector (`Announcement`/`Material`/`Assignment`, each icon + label) used a shrink-to-fit `flex w-fit` row with no wrap -- its natural content width (~360px for all 3 labels + icons + padding) exceeded the space a narrow phone's card actually has available (~310px, after page + card padding), so the row overflowed past the right edge of the screen with nothing to catch it. "Assignment," being the rightmost and one of the longer labels, was the one that visibly ran off.

Fixed in `ClassworkComposer.tsx`: the selector is now a `grid grid-cols-3` below the `sm:` breakpoint -- a grid can never exceed its container's width by construction, whatever the label length, with `truncate` as a graceful (rarely-needed) fallback if a column still runs out of room on an especially narrow device. `sm:flex sm:w-fit` restores the original shrink-to-fit desktop appearance unchanged. Verified: new regression test asserts the selector renders as a 3-column grid; full suite (333/333, up 1), typecheck clean.

## S@Learn Classroom "Stream" tab, mobile: section tabs clipped with no scroll cue (2026-07-31)

Founder screenshot of the Stream tab on mobile showed the workspace section tabs (Stream/Classwork/People/League/Tutor Matches) cut off mid-word ("Tutor Matches" → "Tut") with nothing indicating the row scrolls -- `overflow-x-auto` was already there and functionally correct, but with zero visual affordance it reads as a broken/truncated layout rather than an intentional scroll area.

Fixed in `SLearnClassroom.tsx`: the tab row now tracks its own scroll position and container/content width via a ref + scroll/resize listeners, and renders a fading gradient overlay on whichever edge(s) still have hidden tabs -- never a static always-on fade, since that would falsely suggest more content on a wide screen where every tab already fits. Also tightened `ClassworkComposer.tsx`'s form card padding for mobile (`p-5` → `p-4 sm:p-5`), matching the same responsive-padding pattern applied to the rest of the app earlier today. Verified: new regression test confirms the fade only appears when the tab row actually overflows (jsdom's default zero-width layout correctly shows no fade); full suite (332/332, up 1), typecheck clean.

## Mobile: nested-padding "wasted width" pattern fixed across the app (2026-07-31)

Founder screenshot of the lesson-creation section (`CourseEditor.tsx`, mobile) showed a big chunk of the phone's width going unused around the upload dropzones/preview box. Root cause, found by reading the JSX rather than guessing: 2-3 levels of bordered "card" boxes nested directly inside each other, each with its own fixed `p-4`/`p-6` and no mobile-scaled variant -- e.g. the page wrapper's padding + the lesson-card's padding + the lesson-content box's padding all stacked, eating ~96px (roughly a quarter of a 375px phone screen) from both sides combined before any real content rendered.

Founder also asked to apply the same fix everywhere on mobile, not just this one screen. Used an Explore subagent to search `components/Dashboard/**` and `components/Tutors/**` for the same genuine compounding-nesting pattern (not just any padded card -- only actual parent-padding-directly-containing-child-padding cases). Fixed every confirmed instance by adding a smaller mobile padding with a `sm:` breakpoint back up to the original value, same pattern already used elsewhere in the app (e.g. `px-4 sm:px-6 lg:px-8`):

- `App.tsx`: 3 page wrappers (`my-requests`, `tutor-request-new`, `tutor-request-detail`) used a flat `px-6` with **no** responsive variant at all -- worse than the confirmed bug, since it never scaled down on any screen. Now `px-4 sm:px-6`.
- `InstructorDashboard.tsx`: same flat `px-6` on its own list-view wrapper -- same fix.
- `CourseEditor.tsx`: lesson card (`p-4`) and the lesson-content box nested inside it (`p-4`) -- now `p-3 sm:p-4` each.
- `RequestForm.tsx`: the form's own card (`p-6`) and each child's nested box (`p-4`) -- now `p-4 sm:p-6` / `p-3 sm:p-4`.
- `MatchStatus.tsx`, `Chat.tsx`, `PaymentStatus.tsx`: each component's own root card (`p-6`) -- now `p-4 sm:p-6`.
- `QuizBuilder.tsx`: the quiz card (`p-4`), which itself nests inside `CourseEditor`'s now-fixed lesson card -- now `p-3 sm:p-4`.
- `ApplicationWizard.tsx` + `IdentityCapture.tsx`: the deepest offender found -- wizard card (`p-6`) containing 2 document-upload boxes (`p-4` each), a 3-level non-responsive stack. Wizard card now `p-4 sm:p-6`, both doc boxes now `p-3 sm:p-4`.

Left alone: single-level cards not nested inside another padded box (no compounding to fix), and the smallest inner status/verification boxes (`p-3`/`p-3.5`) that were already near-minimal padding for their content. Verified: full suite (331/331), typecheck clean -- every change is className-only (no JS/behavior touched), so no new tests were required beyond re-running the existing suite.

## Location error message was blaming the wrong settings screen (2026-07-31)

Founder screenshot showed Chrome's own per-site "Location" permission toggle already ON (granted), yet `RequestForm.tsx` still displayed the PERMISSION_DENIED message telling them to "allow location for this site in your browser settings" -- advice that was already followed and couldn't fix anything, since the real block was one level up: the OS/device location-services toggle (common on Chromebooks, and on desktop OSes generally, when system location is off). The 2026-07-30 fix correctly split the 3 `GeolocationPositionError` codes apart but had no way to tell "site-level denied" from "site-level granted, blocked at the OS" -- both surfaced as code 1.

Fixed in `lib/geolocation.ts`: `getCurrentLocation()` now queries the Permissions API (`navigator.permissions.query({ name: 'geolocation' })`) before calling `getCurrentPosition`, and passes the resulting state into `messageForGeolocationError`. When code 1 fires and the site permission was already `'granted'`, the message now points at the device's system-level location service instead of the browser's site settings; falls back to the original site-permission wording when the Permissions API isn't available (older Safari) or the state isn't `'granted'`. Verified: full suite (331/331, up 1), typecheck clean.

## PaymentStatus mobile layout: deposit/balance rows no longer wrap mid-phrase (2026-07-30)

Founder screenshot of the matched-request view (Chat + PaymentStatus) on mobile showed the deposit/balance summary rows wrapping awkwardly mid-phrase (e.g. "en" / "attente" splitting across lines). Root cause: `flex justify-between` forces label and value onto one row, and at phone widths a long label ("Solde (à régler sur place)") next to a long value ("4 000 FCFA — en attente") don't both fit, so the value itself wraps. Changed both rows in `PaymentStatus.tsx` to `flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5` -- stacked (each gets a full-width line) below 640px, back to side-by-side at `sm:` and above. Verified: existing 12 PaymentStatus tests unaffected (className-only change), typecheck clean.

## Tutor-marketplace bug-fix batch: matching deployed, hard-delete, custom subjects, icons, broken-image fallback (2026-07-30)

Founder sent 7 screenshots reporting: (1) location never actually shares even with device location on, (2) no way to request a subject outside the fixed list, (3) tutor matching never happens, (4) "delete request" doesn't really delete anything, (5) some icons aren't representative of what they label, (6) mobile responsiveness issues, (7) the course-detail title looked doubled/badly spaced.

**Matching (2) -- root-caused and fixed for real this time.** `match-tutor-request`, `create-tutor-deposit-checkout`, `cancel-tutor-booking`, and `delete-account` were still returning 404 in production -- confirmed via direct HTTP, same gap flagged in every prior session. The founder provided a Supabase personal access token directly in chat, which unblocked `supabase functions deploy` (previously only migrations were deployable, via `SUPABASE_DB_URL`). All 4 functions are now deployed and responding correctly (401 instead of 404 -- i.e. "needs auth", not "doesn't exist"). Hit one deploy-only issue along the way: `supabase functions deploy` without Docker running couldn't resolve the `@supabase/supabase-js` import-map alias from `deno.json` on its own -- fixed by passing `--import-map supabase/functions/deno.json` explicitly on every deploy.

**Location (1) -- diagnosability fixed, not a code bug per se.** `lib/geolocation.ts` returned one generic message for every failure mode, so "permission denied" (increasingly common in in-app WhatsApp-style webviews, which routinely block the permission prompt entirely) was indistinguishable from a timeout or a real device-location failure. Now surfaces the actual `GeolocationPositionError` code with an actionable message per case (including a hint to open the page in a real browser instead of an in-app preview), plus a longer timeout and `maximumAge` so a genuinely slow-but-working GPS fix doesn't look identical to a permission failure.

**Custom subjects (3).** Added a "+" chip to each child's subject picker in `RequestForm.tsx` that reveals an inline text field and inserts a new row into `categories` -- mirrors `CourseEditor.tsx`'s existing inline category-creation flow exactly, so a custom subject is immediately real and matchable, not a dead-end free-text field. Required `0041_parents_create_categories.sql`, widening the INSERT policy on `categories` from verified-instructors-only (`0028_instructor_create_categories.sql`) to any authenticated user -- a parent creating a request has no instructor/verified trust level to check against, and a new category row is the same low-risk shared lookup value either way.

**Hard delete (4).** `cancelTutorRequest()` previously just set `status = 'cancelled'`, which kept the row visible in "My Requests" with a new label instead of disappearing. `0042_tutor_request_hard_delete.sql` adds a real DELETE policy scoped to `status = 'searching'` -- same boundary as the existing edit policy, since a matched request has conversation/payment history cascading from it via foreign keys, and the delete button was already only ever shown on the "still searching" screen. `cancelTutorRequest()` now calls `.delete()` directly; the confirm-dialog copy was updated to say the action is irreversible instead of implying a soft, reversible stop.

**Icons (5).** `HomePage.tsx`'s "why choose" section rendered the same `CheckCircle` icon for all three cards (pace/certificates/experts), just re-tinted -- not representative of any of them individually. Swapped in `Clock`/`Award`/`GraduationCap` respectively.

**Broken-image overlap (7).** The founder's course-title screenshot wasn't actually a spacing bug -- `CourseCard.tsx` and `CourseDetail.tsx` rendered `course.thumbnail_url` with no `onError` handler, so a broken/slow-loading image left the browser's own alt-text fallback rendering in place with no predictable box, overlapping the real `<h1>` title beneath it. Both now fall back to the same gradient+icon placeholder used when there's no thumbnail at all.

**Mobile (6) -- partially addressed, not a full audit.** Fixed the one concretely reported instance: `ClassworkComposer`'s assignment due-date field (`type="date"`) had no visible label -- date inputs ignore the `placeholder` attribute entirely, so it rendered as a blank, unexplained box, most confusing on mobile where it's the only unlabeled field in its row. A broader "audit every page for mobile responsiveness" wasn't attempted blind -- that needs targeted screenshots per page to fix real issues rather than guessed ones, consistent with this project's own "no fake features" principle.

Verified: full suite passing (330/330 across 57 files, up 8 from the previous phase), typecheck/lint/build all clean, 16 lint warnings held at the established baseline. All 3 new migrations (0041, 0042) verified against the local `ci_test` stub (including the RLS rejection paths) before deploying to production the same way as every prior migration this session.

## i18n Phase 3: tutor-marketplace flow now follows the FR/EN toggle (2026-07-29)

Final phase of the platform-wide i18n sweep: all 7 `components/Tutors/*` files
(`MyRequests`, `TutorMatches`, `TutorProfileForm`, `PaymentStatus`, `RequestForm`,
`MatchStatus`, `Chat`) -- ~1,700 lines, previously 100% hardcoded **French** (the inverse of
the rest of the app, which defaulted to English). Shipped as 2 batches:

- **Batch A** -- `MyRequests`, `TutorMatches`, `TutorProfileForm`, `PaymentStatus`.
- **Batch B** -- `RequestForm`, `MatchStatus`, `Chat` (the booking-negotiation core).

Heavy key reuse against the dashboards-phase dictionary where wording genuinely matched
(teaching-mode options, neighborhood placeholder, response-time options, language toggle
labels) instead of duplicating translations a third time. `Chat.tsx`'s decline-reason chips
(`DECLINE_REASONS` in `lib/matches.ts`: "Trop loin"/"Conflit d'horaire"/"Pas ma matière"/
"Autre") needed the same "translate the label, not the underlying value" treatment as
`course.level` and QuizBuilder's True/False options -- the raw French string is still what
gets passed to `declineMatch()` and stored, since that's app data, not just UI chrome; only
the button's displayed text depends on locale.

This phase inverted the usual test-update problem from Phases 1-2: because this flow was
always French regardless of locale before, every existing test asserted French text
unconditionally. With the toggle now wired, jsdom's default English locale meant every one of
those assertions had to move to English, with a new explicit French-locale test added per
file to keep the original assertion coverage. All 7 test files needed this rewrite (not just
wrapping in `LocaleProvider` as in earlier phases) -- the largest test-only diff of the three
i18n phases.

Verified: full suite passing (322/322 across 57 files, up from 315 -- the 7 added tests are
the new French-locale regression case per file), typecheck/lint/build all clean. Lint's
warning count held at 16 (the dashboards-phase baseline), no new warnings introduced.

## i18n Phase 2: dashboards (student, instructor, reviewer) now follow the FR/EN toggle (2026-07-29)

Continuation of the platform-wide i18n sweep (see Phase 1 below) into the largest remaining
chunk: all 21 Dashboard component files (student dashboard, League, instructor course
management, S@Learn Classroom, the reviewer queue, and the instructor application wizard) --
~500+ strings, previously 100% hardcoded regardless of the FR/EN toggle. Shipped as 4
sequential batches to keep each diff reviewable:

- **Batch A** -- shared dashboard chrome (`DashboardSidebar`, `StreakXPCard`, `LeagueBoard`)
  and the student-facing pages (`League`, `MyProgress`, `StudentDashboard`).
- **Batch B** -- instructor-core surfaces (`InstructorDashboard`, `CourseStudents`,
  `SLearnClassroom`, `InstructorLeague`, `AdminMetrics`). `AdminMetrics.tsx` was previously
  hardcoded *French* (not English) with zero locale-awareness -- brought into the same
  dictionary rather than left as a special case.
- **Batch C** -- content-creation tools (`CourseEditor` -- the largest single file touched
  all sweep, `QuizBuilder`, `ClassworkComposer`, `GradingPanel`, `AddStudentModal`,
  `ReviewQueue`).
- **Batch D** -- the instructor application wizard (`ApplicationWizard`, `IdentityCapture`,
  `VerificationPipeline`).

`CourseStudents.tsx` and `SLearnClassroom.tsx` share a large amount of near-identical copy
("Information"/"Attention" panels, status badges, "Class overall progress" chart, "Add
student") since they're both classroom-management surfaces -- pulled into a shared
`dashboard.classroom.*` key namespace instead of duplicating translations across both files.
`course.level` and moderation-status enums (`pending`/`approved`/`rejected`) continue the
established pattern of translating fixed-value enums as UI chrome via small `*_KEYS` lookup
maps, while free-text instructor-authored content (course descriptions, application bios,
reviewer notes) stays untranslated by design.

QuizBuilder's True/False quiz-answer options needed special handling: the underlying stored
value (`'True'`/`'False'`, used for `correct_answer` comparison and persisted to the DB) had
to stay in English regardless of locale, while only the *displayed* radio label translates --
same "translate the label, not the underlying value" pattern as the level/status enums, just
applied to data the app itself writes back rather than reads.

A genuine regression was caught by the full suite, not introduced by scope creep:
`AccountSettings.test.tsx` (a file **outside** this phase's scope) broke because
`AccountSettings.tsx` renders the now-`useLocale()`-dependent `DashboardSidebar` --
its test render helper needed a `LocaleProvider` wrapper even though `AccountSettings.tsx`
itself wasn't touched. Fixed by wrapping its existing render helper, not by translating
`AccountSettings.tsx` (that's a later phase).

Verified: full suite passing (315/315 across 57 files, including 8 new test files for
previously-untested components -- `QuizBuilder`, `ReviewQueue`, `CourseEditor`,
`InstructorDashboard`, `StudentDashboard`, `VerificationPipeline`, `IdentityCapture`, plus
`ApplicationWizard`'s existing tutoring-section test extended with a French case),
typecheck/lint/build all clean. Lint's warning count moved from 15 to 16 -- the new one is
the same pre-existing "missing effect dependency on a locally-defined mount-once function"
shape already present ~7 times elsewhere in this codebase (`CourseStudents`,
`InstructorDashboard`, `StudentDashboard`, `CourseEditor`, etc.), not a new category of issue.

## i18n Phase 1: public/marketing surfaces now follow the FR/EN toggle (2026-07-29)

Founder reported "the language doesn't apply to all the platform" -- the FR/EN toggle only
ever touched the header nav; every other surface was hardcoded (mostly English, with the
tutor-marketplace flow hardcoded French instead). A background audit found ~53 component
files, ~49 of them ignoring locale entirely. Given the size, locked in scope via
AskUserQuestion before writing code rather than guessing:

- **Rollout order**: public/marketing surfaces first (Header was already done; this phase
  covers Home/Landing, Footer, and course-browsing chrome). Dashboards, tutor-marketplace,
  account settings, and the auth modal are later phases -- not touched here.
- **Mechanism**: keep hand-rolling the existing flat-key `lib/i18n.ts` dictionary rather than
  pulling in `react-i18next`. `t(key)` indexes `translations[locale][key]`, and TypeScript's
  structural indexing on `TranslationKey = keyof translations['fr']` already enforces FR/EN
  key-set parity for free -- confirmed via a clean typecheck after every dictionary edit.

**Shipped**: `HomePage.tsx`, `LandingPage.tsx`, `Footer.tsx`, `CourseList.tsx`,
`CourseCard.tsx`, and `CourseDetail.tsx`'s browsing chrome (section headers, meta labels,
enroll button variants, sidebar perks, toasts) all wired to `useLocale()`/`t()`. ~120 new
keys added to `lib/i18n.ts` across `common.*`/`home.*`/`landing.*`/`footer.*`/`courses.*`/
`courseDetail.*`. `course.level` is treated as translatable UI chrome (a fixed 3-value enum)
via a small `LEVEL_KEYS` lookup in `CourseCard`/`CourseDetail`; `course.description`,
`instructor.bio`, and review comments are deliberately left alone -- that's instructor- and
student-authored content, not UI chrome, and stays out of scope for this sweep. No
interpolation was added to `t()` -- composed strings ("Load more (N remaining)", "Enrolled --
X% complete") are built by joining separately-translated fragments in JSX instead.

Caught a real bug while wiring, not via a failing test: `LandingPage.tsx`'s trust-strip
`.map((t) => ...)` callback shadowed the newly-destructured `const { t } = useLocale();`,
which would have silently rendered every trust-strip label as `undefined`. Renamed the loop
variable before it ever ran.

Verified: full suite passing (238/238 -- 2 apparent failures in the full parallel run were
the sandbox's known worker-timeout flake under memory pressure, confirmed by rerunning both
files, and all 6 touched/new test files, in isolation), typecheck/lint/build all clean.

## RequestForm redesign: multi-child, multi-subject, location, edit/cancel (2026-07-29)

Founder's screenshot batch asked for a more precise tutor-request form (multiple children
with a level per child, multiple subjects, a Google Maps location so the matched instructor
can navigate to the house) plus a way to edit or delete a submitted request. Three scope
forks were locked in via AskUserQuestion rather than guessed, given the size of the schema
change each option implied:

- **One TutorRequest row per child, per subject** (not one row holding an array) -- keeps
  today's schema and matching model completely unchanged. A parent with 2 children needing 2
  subjects each now submits once and gets 4 rows created, not 1 row with nested data the
  matching engine would need to learn to unpack.
- **Editable/cancellable only while status is 'searching'** -- once a tutor is matched,
  they've already committed; editing at that point would be confusing, so it's locked both
  in the UI and in a new RLS policy. "Delete" is a soft-cancel (`status = 'cancelled'`,
  already a valid value in the original check constraint), never a hard row delete.

**Schema** (`0040_tutor_request_location_edit.sql`, verified against a local Postgres stub
including the RLS rejection paths, then deployed to production the same way as 0034-0039):
`location_lat`/`location_lng` columns; `create_tutor_request()` extended with 2 new
default-null params (backward compatible); a brand-new UPDATE policy on `tutor_requests` --
there was previously no UPDATE policy at all, only SELECT, so editing/cancelling genuinely
didn't exist as a capability before this. Verified specifically that a parent cannot use this
new policy to self-promote a request to `'matched'` (that transition stays the matching
engine's alone) -- caught this by first writing a test where the row was already
`'cancelled'` from a prior step in the same fixture, which passed for the wrong reason
(`using` already excluded it); rewrote with a genuinely still-`'searching'` row to confirm
the `with check` clause itself is what blocks it.

**Frontend**: `RequestForm.tsx` rebuilt around repeatable child blocks (each with its own
level + a multi-select subject picker as toggle pills, not a native multi-select), a "share
my exact location" button using the browser Geolocation API (`lib/geolocation.ts`) -- a real
device position, not a typed address, so the link is unambiguous -- shared across every
request created in one submission. `lib/tutorRequests.ts` gained `googleMapsLinkFor()`,
`updateTutorRequest()`, `cancelTutorRequest()`. `MatchStatus.tsx`'s "still searching" screen
(where the founder's screenshot circled empty space next to "Réessayer la recherche") gained
"Modifier la demande" (opens an inline edit panel, pre-filled) and "Supprimer la demande"
(a real `ConfirmDialog`, not a fake button) -- addressing the specific gap. `onSubmitted`'s
signature changed from a single request to an array; `App.tsx` navigates straight to
`MatchStatus` when exactly one request was created (unchanged UX for the common case) or to
`MyRequests` when several were.

Verified: 279/279 tests passing (25 new across `RequestForm`, `MatchStatus`,
`lib/tutorRequests.ts`, and a new `lib/geolocation.ts`), typecheck/lint/build all clean.

## Footer mobile link-grid (2026-07-29, follow-up)

Founder's screenshot circled the "For Learners"/"For Educators"/"For Organizations" link
columns, which collapse to a single stacked column below the `sm` breakpoint -- a long
scroll of links instead of a scannable grid. Changed `grid-cols-1 sm:grid-cols-3` to
`grid-cols-2 sm:grid-cols-3` so mobile gets 2 columns (3 sections fit as 2+1) instead of 1.
Left the top audience-links row (`Individuals`/`Courses`/etc.) alone -- it wasn't
specifically circled, and it already degrades to a reasonable 3-row x2 grid via `flex-wrap`,
not a long single-column scroll.

## Migrations 0034-0039 deployed to production; real matching + Header bugs fixed (2026-07-29)

Founder sent a batch of screenshots. One (the totem picker showing "Could not find the
'totem' column of 'profiles' in the schema cache") was the first hard proof that migrations
0034-0039 had never actually reached production, despite being committed and locally
verified all session -- every session note calling this "pending deployment" turned out to
be actively broken in the live app, not just an abstract gap.

- **Deployed migrations 0034-0039 to production.** `.env` has a `SUPABASE_DB_URL` (a session
  pooler connection string) that doesn't need `SUPABASE_ACCESS_TOKEN`/`supabase login` at
  all -- `supabase db push --db-url ...` works without either. Two gotchas hit along the way:
  (1) the password in `.env` has an unescaped `@`/`+` that breaks naive URI parsing --
  needed percent-encoding (`%40`, `%2B`) before `psql`/`supabase` would accept it; (2) the
  pooler's transaction-mode port (6543) fails migration pushes with `prepared statement
  "..." already exists` (PgBouncer transaction pooling doesn't support prepared statements
  reliably) -- the session-mode port (5432) on the same pooler host works. Verified after
  the fact: `totem` column exists, `classwork_posts`/`classwork_submissions` tables exist,
  `get_global_league`/`get_course_league`/`get_instructor_league` all exist. This retroactively
  turns on the League and Classwork features in production for the first time -- they were
  fully built and tested locally but never live until now.
- **Diagnosed "tutor request matching is not sent" to its actual root cause**, rather than
  guessing: confirmed via a direct HTTP call that `match-tutor-request` (along with
  `create-tutor-deposit-checkout`, `cancel-tutor-booking`, `delete-account`) is a real 404 in
  production -- those edge functions were written and locally verified this session but
  **still can't be deployed without `SUPABASE_ACCESS_TOKEN`/`supabase login`**, which is a
  different credential than the DB URL above and remains unavailable. Given that constraint,
  fixed what's actually fixable in the client: `RequestForm.tsx`'s `handleSubmit` had
  `matchTutorRequest` inside the same `try` block as `createTutorRequest`, so when matching
  failed, the whole submission looked like it failed even though the request row was already
  saved -- `MatchStatus.tsx`'s own retry button already treats a match failure as non-fatal
  ("zero-match is not an error state"); `RequestForm` just wasn't following its own
  established pattern. Now it does: the request is created, matching is attempted and its
  failure is swallowed the same way, and the parent always lands on the "still searching"
  screen instead of a raw error. **The underlying 404 is still there** -- this fix means a
  parent's request now actually gets saved and they see the right screen, but real matching
  won't run until the edge functions are deployed. Still needs the founder to either run
  `supabase login` (they can do this themselves via the `!` prefix in this session, which
  would then let deployment happen) or share an access token.
- **Fixed a real Header layout bug** (confirmed via 2 landscape-orientation screenshots): at
  roughly 768-1024px width (landscape phones, small tablets), the full desktop nav (5 links +
  the entire profile/actions cluster) doesn't actually fit, and was rendering with the
  wordmark and "Home" nav pill visibly overlapping, and "Find a Tutor" wrapping across 3
  lines. Root cause: the desktop-nav-vs-hamburger breakpoint was `md:` (768px), too narrow
  for how much this nav actually contains. Moved to `lg:` (1024px) and added
  `whitespace-nowrap` to every nav button as a second layer of defense.
- **Category filter chips now scroll horizontally instead of wrapping to 3 rows on mobile**
  (`CourseList.tsx` and `HomePage.tsx` both had this, same root cause both places) --
  confirmed via screenshot showing the wrapped state eating most of the visible viewport
  before any course content appeared.

Verified: 264/264 tests passing (2 new: a `RequestForm` regression test for the resilience
fix, a `Header` regression test for the breakpoint fix), typecheck/lint/build all clean.

**Still open from this same founder batch, deliberately not guessed at** (see the
AskUserQuestion round that followed): RequestForm precision (multiple children with a level
per child, multi-subject selection, a Google Maps location picker), an edit/delete action on
a submitted tutor request, and footer mobile intuitiveness -- each has a real data-model or
scope fork that shouldn't be guessed on given the size of what's being committed to.

## Mobile button-wrap bug + heading hierarchy (2026-07-28, second pass)

Founder sent 2 WhatsApp screenshots of the mobile lesson page: one showing "Take completion
quiz to finish" wrapped across 4 lines inside a fixed-height pill (their advice: shrink text
responsively), another showing a wall of undifferentiated prose with "no way to differentiate
heading, sub heading, chapters, sections."

- **Root cause of the wrap, found by reading the code, not guessed**: the lesson-footer nav
  row (`LessonViewer.tsx`) packed 2-3 buttons into one `flex` row with no `whitespace-nowrap`
  and a fixed `h-11`. On a narrow phone, the row squeezed the longest label ("Take completion
  quiz to finish") until it wrapped vertically while the button's height stayed fixed at
  44px, so the text spilled out past the button's visible bounds. Fixed properly rather than
  just shrinking the font: the row now stacks vertically (`flex-col sm:flex-row`) on mobile
  so buttons never compete for horizontal space, every button got `whitespace-nowrap`, and
  the long label gets an explicit shorter mobile variant ("Take quiz to finish") alongside
  the full desktop text — applying the founder's "reduce text on small screens" instinct to
  the one label that's actually long, not blanket-shrinking body copy that was already a
  perfectly normal 16px.
- Also found and responsively sized 2 more dynamic, potentially-long titles that were fixed
  at `text-3xl` regardless of viewport: the lesson title itself and the quiz title
  (`QuizViewer.tsx`) -- both now `text-2xl sm:text-3xl`.
- **Heading/hierarchy complaint**: the specific screenshotted lesson's actual stored content
  has zero markdown structure at all (confirmed -- it's real founder-authored data, not seed
  content, so it wasn't something to rewrite without being asked). The legitimate code-level
  fix is making sure content THAT DOES use structure renders unmistakably: gave `lib/richText.tsx`'s
  3 heading levels genuinely distinct treatments instead of just 3 font sizes -- level 1 (`#`)
  reads as a chapter/section break (display serif, bottom border, most spacing), level 2
  (`##`) as a plain sub-heading, level 3 (`###`) as a small-caps "eyebrow" label matching the
  same treatment already used for category tags elsewhere in the app. Also updated
  `CourseEditor.tsx`'s lesson-content formatting hint to mention lists/code/headings, not just
  bold/italic, so instructors actually discover these tools exist when writing new lessons.

Verified: 262/262 tests passing (1 new heading-hierarchy case in `richText.test.tsx`),
typecheck/lint/build all clean.

## Dark code block, non-responsive People chart, sticky nav, audience wordmark (2026-07-28)

Founder pasted a screenshot (the same dark code block from the CSS lesson) plus a screen
recording showing the mobile experience, and asked for 4 things.

- **Dark code block → light**: `lib/richText.tsx`'s fenced-code-block rendering used
  `bg-gray-900 text-gray-100` -- a genuinely dark box that clashes with the rest of the
  app's paper-light surfaces. Changed to `bg-gray-50` / `text-gray-800`, matching the
  existing inline-code style.
- **S@Learn Classroom's People page didn't fit on any screen**: found via the recording --
  an instructor with 20 courses saw the "Class overall progress" chart's bars (`flex-1`
  each, dividing available width evenly across an unbounded course count) squeeze down to
  unreadable slivers with 1-3-character truncated labels ("N...", "C...") AND still overflow
  past the right edge of the viewport, with no way to scroll to the cut-off bars. Fixed:
  each bar is now a fixed `w-9`, in a `overflow-x-auto` track -- scrolls on any screen
  regardless of course count, instead of squeezing infinitely. (Checked `CourseStudents.tsx`'s
  own progress chart for the same bug -- it's always exactly 3 fixed buckets
  [not-started/in-progress/completed], so it was never at risk.)
- **Nav bar now stays fixed on scroll, on every page and every account**: `AudienceNav` (the
  Individual/Schools/Business/Government tabs) was never sticky -- only the `<header>` below
  it was, so on scroll the tabs vanished while the header alone snapped to the very top, a
  visible jump. Wrapped both in one shared `sticky top-0 z-40` container in `Header.tsx`.
- **Header wordmark now reflects the active audience track**: clicking Schools/Business/
  Government already showed distinct page content (`InstitutionalLandingPage`, built
  2026-07-23), but the header itself never changed, so there was no per-track "reflection"
  visible in the app's own chrome. Added a `· Government`/`· Business`/`· Schools &
  Universities` suffix next to the "S@Learn" wordmark while on that page (hidden on very
  small screens via `hidden sm:inline`, in keeping with this same request's own "not
  responsive" complaint). Scoped to the institutional landing pages themselves -- not
  extended into a full per-track dashboard/color-theme, since no such thing exists yet and
  building one wasn't what was asked.

Verified: 261/261 tests passing (5 new: `Header.test.tsx`), typecheck/lint/build all clean.
Full-suite runs were unusually slow this session (up to 140s vs. the normal ~90s, one run
had to be killed and retried) due to severe pre-existing memory pressure from other
processes already running in this sandbox (VS Code, tsserver, Codeium, ~6GB of 6.3GB used
before any test run even starts) -- not a regression from these changes; confirmed via a
narrower, fast, clean run of just the touched test files before the full suite finally went
through.

## Real markdown gap found via screenshots + more icon spots (2026-07-27)

Founder pasted 6 screenshots (category chips, course card meta, a "Why choose" feature
callout, CourseDetail's meta row, the instructor card/reviews header, and — critically — a
live lesson page) asking for richer text/icons "on the entire platform." Cross-checked each
screenshot against current source before touching anything:

- **Category chips, instructor-card avatar, and "Student reviews" header were already fixed**
  in the previous two commits (`ac1e24b`, `11225f5`) — the flat-looking versions in those
  screenshots are almost certainly the live site not having redeployed yet, not a code gap.
  Worth double-checking the Vercel deploy actually picked up the latest push if they still
  look flat after a refresh.
- **The lesson-content screenshot exposed a real, serious bug**: actual lesson content (a
  "CSS Box Model" lesson) uses bullet lists, inline `` `code` ``, and fenced ` ```css ` code
  blocks — none of which `lib/richText.tsx` understood. Instead of rendering nicely, students
  were seeing literal `**`, `-`, and backtick/fence characters cluttering the text, which is
  arguably *worse* than the plain-text rendering from before rich text existed at all.
  Rewrote `renderRichText` into a real (still dependency-free) block parser: fenced code
  blocks → `<pre><code>`, inline code → `<code>`, `-`/`*`/`1.` lists → `<ul>`/`<ol>`,
  `#`/`##`/`###` → heading tags, on top of the existing bold/italic/paragraph handling.
  Reconsidered and still deliberately chose NOT to add `react-markdown`/`remark-gfm` for
  this — the block set actually observed in real content is bounded and now fully covered by
  the hand-rolled parser, and a full remark/unified pipeline is real added bundle weight for
  marginal correctness gain at this scope. Added a regression test using the exact mixed
  content from the screenshot.
- **Found 3 more icon spots the earlier Explore-agent sweep missed**, all bare/uncolored
  icons rather than icons inside a tinted container (which is what that sweep's search
  pattern looked for): `CourseCard.tsx`'s duration/enrollment meta icons, `CourseDetail.tsx`'s
  meta row (Users/Clock/BookOpen), and `HomePage.tsx`'s own separate "Why choose S@Learn?"
  section (a near-duplicate of LandingPage's already-upgraded pillars, but a different file,
  so it was invisible to a search for colored *container* badges specifically).

Verified: 256/256 tests passing (7 new richText cases covering lists/code/headings + the
exact screenshot content), typecheck/lint/build all clean.

## Platform-wide rich text + icon badge sweep (2026-07-27)

Founder, after the classwork/S@Learn Classroom pass: "apply the richer text and icons on
every component of the Platform even on course created and creation(this was even the main
area where richer text should've been applied)." Used an Explore subagent to catalog every
remaining flat-tint icon badge and every plain-text render of a freeform human-authored field
across `components/`, then worked through the full list rather than cherry-picking a few
visible spots.

**Course creation (the flagged priority):** `CourseEditor.tsx` now shows a live
`RichTextPreview` under BOTH the course description field and each lesson's text-content
field — renders through `lib/richText.tsx` as you type, so **bold**/*italic* formatting is
visible during creation, not just after publishing. This was the actual gap the founder
meant: the description textarea got a hint text on 2026-07-27 earlier today, but nothing
showed instructors what it would look like rendered, and lesson content (the real bulk of a
course) hadn't been touched at all.

**Rich text, extended to 12 more render sites**: `LessonViewer.tsx` (lesson description +
content — probably the single highest-value target, since it's the actual reading material
students spend the most time on, previously plain `whitespace-pre-wrap` text), instructor
bios (`CourseDetail.tsx`, `ReviewQueue.tsx`'s application-review view), review comments
(`CourseDetail.tsx`, `LandingPage.tsx` testimonials), quiz descriptions (`QuizViewer.tsx`),
classwork post bodies/submission content/feedback (`ClassworkList.tsx`, `SLearnClassroom.tsx`,
`GradingPanel.tsx`), and course descriptions in the admin moderation queue
(`ReviewQueue.tsx`). Deliberately NOT applied to single-line `truncate`/`line-clamp-2`
preview contexts (`CourseCard.tsx`, `InstructorDashboard.tsx`'s course-card blurb, the
curriculum list's lesson description, a quiz question's `question_text` inline in a heading)
— `renderRichText` emits block-level `<p>` tags, which breaks single-line truncation CSS;
these are short previews, not the primary reading surface anyway.

**Icon badges, extended to 19 more locations** via a new shared
`components/UI/IconBadge.tsx` (+ `lib/iconBadgeTones.ts` as the single source of truth for
the gradient palette, which `StatTile.tsx` now also imports from instead of duplicating its
own copy): avatar fallbacks (`AccountSettings`, `Header` x2), student-initial avatars
(`CourseStudents`, `SLearnClassroom`), landing-page pillars, `CourseDetail`'s section headers
and curriculum status icons, `LessonViewer`'s sidebar status icons + 2 toggle buttons + PDF
icon, `ConfirmDialog`'s warning icon, `AuthModal`'s 2 success icons, `QuizViewer`'s 2
pass/fail result icons, and `StreakXPCard`'s flame/trophy (kept as separate `orange`/`gold`
tones, not merged into one — the founder's own "keep my colors" note on that file says these
are deliberately different semantic tints, fire vs. trophy, not the same color).

**Deliberately left flat, not an oversight**: `CourseStudents.tsx`'s icon rail and compact 2x2
stat tiles (an intentional style boundary from the 2026-07-24 pass); classwork type-label
pills (`TYPE_META` in `ClassworkList.tsx`/`SLearnClassroom.tsx`) and Draft/Live/Pending status
badges everywhere — these are text-plus-icon *status pills*, a different, already-consistent
design language from decorative icon badges, and a gradient background would hurt legibility
at that size; primary-action buttons using `bg-primary-500`/`hover:bg-primary-400` (e.g. the
Kairos Mind send button) — those are the app's actual button language, not decorative icon
tints, and re-skinning every button was a different, much bigger ask than "richer icons."
Chat bubble bodies (`Tutors/Chat.tsx`, `KairosMindTutor.tsx`) were flagged as lower-confidence
by the research pass and left alone — `renderRichText`'s block-paragraph output doesn't suit
a chat-bubble layout, and Kairos Mind's replies are AI-generated, not human-authored text.

Verified: 249/249 tests passing (5 new: `IconBadge.test.tsx`; the rest covered by existing
suites since these were presentational swaps, not new logic), typecheck/lint/build all clean.

## Instructor dashboard overhaul: S@Learn Classroom becomes the whole workspace (2026-07-27)

Founder: "the Slearn Classroom is not just a tab it's the entire management dashboard for
instructor" — combine student management, classwork/assignments, league, and tutor matching
into one Google-Classroom-inspired workspace, plus search/filter on the Courses tab and a
typography/icon polish pass. Four sub-items, each with its own scoping decision locked in via
AskUserQuestion rather than guessed:

1. **Classwork went with the full option** (due dates, submissions, grading — not just an
   announcements feed), and **one combined workspace with a course-switcher inside** (not a
   per-course Classroom clone) — both explicit founder picks over the "lighter/recommended"
   alternative. New tables `classwork_posts` (announcement/material/assignment, one feed) and
   `classwork_submissions` (`0039_classwork.sql`) — attachments are a pasted link, not a file
   upload (real storage pipeline is more scope than this pass; see the migration's own
   comment). Both security-enforced via actual RLS policies, **not** security-definer
   functions like `0038_league.sql` — a real methodology gap surfaced while testing this:
   testing via `sudo -u postgres psql` alone gives **false confidence** for raw-table RLS,
   because `postgres` is a superuser (bypasses RLS entirely) and owns every table. The first
   fixture run "passed" every rejection case vacuously. Fix: `set local role authenticated;`
   after fixture setup, before the actual assertions — re-verified and caught a real hole
   (an instructor could otherwise post into another instructor's course) that the first,
   invalid run had missed entirely. **Any future local RLS verification on a raw table policy
   (not a security-definer function with its own manual `raise exception` check) must use
   this pattern** — this is now a standing process note, same weight as the `npm run
   typecheck` lesson below.
2. `InstructorDashboard.tsx` collapsed from 4 top-level tabs to 2: **Courses** (CRUD, now
   with a real search box + status filter — draft/pending/live/changes-requested) and
   **S@Learn Classroom**, which absorbed the old separate Tutor Matches and League tabs as
   internal sections.
3. `SLearnClassroom.tsx` restructured around 5 sections (Google Classroom-style sub-nav):
   **Stream** (post announcements/materials/assignments via `ClassworkComposer.tsx`),
   **Classwork** (assignments + `GradingPanel.tsx` drill-in for grading), **People** (the
   2026-07-24 cross-course learner roster, unchanged), **League** (`InstructorLeague.tsx`,
   already built), **Tutor Matches** (moved in as-is from the old top-level tab). A course
   filter dropdown scopes Stream/Classwork to one course or "all courses" — People/League
   keep their own existing scoping (aggregate / instructor-picks-per-tab), not double-filtered
   by this dropdown too.
4. Students see classwork on `CourseDetail.tsx` via new `ClassworkList.tsx` — read-only for
   announcements/materials, inline submit/resubmit box for assignments, switches to a
   read-only grade+feedback display once graded. Hidden entirely if nothing's posted yet,
   matching how that page already omits other empty sections (e.g. reviews).
5. **Course presentation polish**: course descriptions now render through a small
   zero-dependency `lib/richText.tsx` (`**bold**`/`*italic*`/paragraph breaks) instead of
   plain text — a full markdown library was more than a short course blurb needs. Section
   headings on `CourseDetail.tsx` (About/Course content/Student reviews) got a small icon
   badge for visual hierarchy. `CourseEditor.tsx`'s description field now hints at the syntax.
6. **Icon treatment upgrade** (founder shared a "realistic icons" Figma reference I can't
   fetch — no browsing access to Figma's viewer, no image-generation capability to produce
   matching art; founder chose "upgrade within lucide-react" over the other two options
   offered). New shared `components/UI/StatTile.tsx`: gradient badge background + soft shadow
   + a semi-filled icon (`fillOpacity`) instead of a flat single-tint background. Applied to
   `StudentDashboard`/`MyProgress`'s stat tiles, `InstructorDashboard`'s course-card mini
   stats, `CourseDetail`'s sidebar perks list, and `LeagueBoard`'s top-3 medal badges
   (gold/silver/bronze gradients instead of a flat tint). Deliberately did NOT touch every
   icon in the app (e.g. `CourseStudents`' compact 2x2 tiles, its nav rail) — scoped to the
   clearest, most-repeated "icon badge" motif rather than a file-by-file pass across the
   whole codebase.

Verified: 245/245 tests passing (33 new: `classwork.test.ts`, `richText.test.tsx`,
`ClassworkComposer.test.tsx`, `GradingPanel.test.tsx`, `ClassworkList.test.tsx`, a rewritten
`SLearnClassroom.test.tsx` for the new IA), typecheck/lint/build all clean. Migration
`0039_classwork.sql` **not yet deployed** — same credential gap as everything else pending.

## My Progress + League — Pathfinder reference (2026-07-27)

Founder shared the Pathfinder sidebar again and asked for "My Progress" (cross-course
progress) and "League" (rank + level, split into a Global league and a per-instructor
"S@Learn Classroom" league that the instructor organizes for their own courses, each or
combined), plus a "For Teachers" nav item that routes a student into the existing
become-instructor flow.

**Ranking architecture (migration `0038_league.sql`):** XP is computed live from
`lesson_progress`/`quiz_attempts` (same formula as `lib/gamification.ts`: 10 XP/completed
lesson, 15 XP/passed quiz, counted once per quiz) — no new counters to keep in sync. Three
security-definer RPCs, all scoped by the courses actually being ranked (using a student's
platform-wide XP for every scope would make "course league" and "instructor global league"
collapse into the same ranking):
- `get_global_league(p_limit)` — every student on the platform, all-time XP. Always
  includes the caller's own row even outside the limit, so the UI can show "you're #142."
- `get_course_league(p_course_id, p_limit)` — one course's XP only. Caller must be enrolled
  in the course or be its instructor, or it raises — these functions bypass RLS, so they
  enforce their own authorization. Verified locally: an outsider gets rejected; a student
  enrolled in two instructors' courses correctly scores 0 XP in the course they haven't
  touched, even though their platform-wide XP is nonzero (confirms the scoping actually
  works, not just that the query runs).
- `get_instructor_league(p_course_id, p_limit)` — the instructor's own view: null course_id
  = all courses they teach combined ("global"), a specific course_id = just that course.
  Always scoped to courses THEY teach.
- **Not yet deployed** — same credential gap as every other migration/edge function this
  session (no `SUPABASE_ACCESS_TOKEN`); verified against the local Postgres stub only.

**Decisions locked in via AskUserQuestion rather than guessed:** all-time XP (not a
weekly-reset ladder — that's real cron-job-shaped work, deferred, see the LMS overhaul
track below if it's ever wanted); a student enrolled with several instructors gets a
dropdown to switch between each course's classroom league (not one merged board); the
instructor's League tab is view-only (no configurable ranking rules).

- [x] `lib/league.ts` — RPC wrappers + `fetchStudentCourseOptions` for the dropdown.
- [x] `components/Dashboard/LeagueBoard.tsx` — shared ranked-list UI (rank, totem, name, XP,
  "(You)" highlight), reused by both the student and instructor league views.
- [x] `components/Dashboard/MyProgress.tsx` — student-only, detailed per-course breakdown
  (progress %, lessons done/total, certificate status), distinct from the Dashboard's
  card-grid overview.
- [x] `components/Dashboard/League.tsx` — student-only, Global/Classroom tabs.
- [x] `components/Dashboard/InstructorLeague.tsx` — new tab inside `InstructorDashboard`.
- [x] `DashboardSidebar` — added My Progress/League/For Teachers to `STUDENT_ITEMS` (For
  Teachers routes to the existing `become-instructor` page — not a new page).
- **Found and fixed a real race, not just a flaky test:** `League.tsx`'s data-fetch effect
  was originally keyed on `[scope, selectedCourseId]` — but `selectedCourseId` changes
  shortly after mount (once the course dropdown loads), which re-triggered the effect even
  while `scope` was still `'global'`, firing a second, redundant `fetchGlobalLeague()` call
  that raced the first. Split into two effects (one keyed on `[scope]` for the global
  fetch, one on `[scope, selectedCourseId]` for the classroom fetch) — confirmed the
  associated test failed intermittently before the fix (1 in ~3 runs) and passed 5/5 after.

## Profile page rebuild — Pathfinder reference (2026-07-27)

Founder shared the Pathfinder "Profile" settings page and asked for it on the platform,
"keeping a reflection to my app." Rebuilt `AccountSettings.tsx`: persistent `DashboardSidebar`
(now reachable from this page too, not just the dashboard), a profile header card (avatar +
name + a REAL status badge), then grouped sections — Basic information (name/bio + totem
picker, students only), Account information (email), Password, and a new Delete Account
section.

**Deliberately not copied from the reference:** the "Free" subscription pill (no paid tiers
exist), the public-profile link + "Show Certificates/Spaces in Profile" visibility toggles
(no public profile page exists — a toggle for a page that isn't there would be dead UI,
same anti-pattern as the earlier "Assign Products/Goals" call). The header shows what's
actually real instead: a verified-instructor badge for instructors, or a totem + league tier
for students.

- [x] **DashboardSidebar** gained a `role` prop — "My Requests"/"Certificates" are
  student-only concepts and AccountSettings is shared by both roles; an instructor now sees
  just Dashboard/Profile.
- [x] **Delete Account — built for real, not decorative.** New `delete-account` edge function
  (`supabase/functions/delete-account/index.ts`, type-checked + linted locally with `deno`):
  always deletes the CALLER's own account only (no target-user param, so it can never be
  used on someone else's account), via `admin.auth.admin.deleteUser()`. `profiles.id` already
  has `on delete cascade` to `auth.users` (0001_core_schema.sql), so this cascades through
  everything the account owns without a manual cleanup pass. Client side: `ConfirmDialog` +
  `useToast`, sign-out + redirect home on success. **Not yet deployed** — same gap as every
  other edge function this session (match-tutor-request, create-tutor-deposit-checkout,
  cancel-tutor-booking, instructor-approval); still blocked on a `SUPABASE_ACCESS_TOKEN`.

## Global footer (2026-07-24)

Founder shared a W3Schools footer screenshot and asked for a footer on the platform.
Built `components/Layout/Footer.tsx`: dark band, logo + top audience-link row (6 links,
matching the reference's 6-header-link row), a 3-column link grid, a disclaimer, and a
copyright line. Rendered globally from `App.tsx`, but only on the public/marketing-ish
pages (home, courses, course-detail, the 3 institutional pages) — not inside the
authenticated dashboard shell, matching how the reference itself only shows this footer on
marketing pages, not its own logged-in dashboard.

**Every link routes somewhere real.** Deliberately did NOT copy the reference's
Terms-of-use/Privacy-policy/Cookies links or its social-media icon row — S@Learn has none
of those yet (regulatory/compliance is still the explicit P3 "let's talk first" item; no
real social accounts exist), and a footer link to a dead page is worse than not having the
section. The 4-column link grid became 3 columns for the same reason: real content
(Browse courses/Find a tutor/My certificates, Become an instructor, the 3 institutional
tracks) filled 3 columns honestly; padding to 4 with fabricated categories wasn't worth
matching the reference's exact count.

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
