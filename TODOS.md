# TODOS

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
