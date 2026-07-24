# Design System — S@Learn

## Product Context
- **What this is:** S@Learn ("Store of Learning"), an online learning and tutor marketplace launching in Douala, Cameroon.
- **Who it's for:** Parents booking verified tutors for their children, students becoming tutors, students uploading/buying access to solved past exam papers. Users span a wide range of device capability, network conditions, and tech literacy.
- **Space/industry:** Ed-tech / two-sided marketplace, pivoting from a generic course catalog (Coursera/Udemy-style) toward tutor booking + an exam-paper economy.
- **Project type:** Web app (React 18 + Vite + Tailwind + Supabase), marketing pages + authenticated dashboards.

## Memorable Thing
**"World-class, built for us."** Not a stripped-down African version of a Western product — genuinely polished and globally credible, with local specificity (FCFA pricing, French-first copy, real local exam systems, verified-tutor trust) coming through content, not decorative "African" visual motifs.

## Aesthetic Direction

**Two registers, one product (added 2026-07-24):** founder feedback: the ink-and-paper
system is "actually good" but "lacks some major modern aspect" — pointed at W3Schools'
visual richness (color, card elevation, real icons/motion) as the missing quality, not its
product model. Resolved as a deliberate split rather than a system-wide reversal:

- **Editorial register** (booking/tutor-marketplace flow — `RequestForm`/`Chat`/
  `MatchStatus`/`PaymentStatus`, plus the institutional marketing pages) stays exactly as
  below: restrained, typographic, minimal motion. This is where "considered, credible, not
  generic-SaaS" still does real trust work — a booking/payment flow and a first-impression
  marketing page are the wrong place to add visual noise.
- **Product register** (authenticated dashboards — `StudentDashboard`, `InstructorDashboard`,
  `CourseStudents`, gamification surfaces) leans into the modern energy: real elevation
  (soft shadows, not flat borders), icons for gamification (a real flame/trophy/lightning,
  not typographic-only), and noticeable (not decorative) motion — hover lift, animated
  progress fills. These pages already run on the older gold/DM-Sans token system, not
  ink-and-paper, so this is additive richness on top of that system, not a new palette.
  See "Product Register" below for the specifics.

The rest of this Aesthetic Direction section (and the Color/Motion sections below)
describes the **Editorial register** — unchanged since 2026-07-17.

- **Direction:** Editorial/Magazine, restrained — "ink-and-paper" credibility. A well-made gradebook, not a generic SaaS dashboard.
- **Decoration level:** Intentional — a verification-stamp motif used only where verification is real (tied directly to `paper_solutions.verification_status`), never as decoration. No stock photography, no gradient hero, no animation-heavy imagery.
- **Mood:** Considered, credible, quietly confident. Trust comes from typographic craft and real verified data, not from decoration or media weight.
- **Reference sites:** Preply (tutor-marketplace trust patterns — deliberately NOT adopting its stock-photo hero), Flutterwave (proof that African-built products can be genuinely global-caliber), Coursera (outcome-stat-as-trust-device, adapted to real verification data instead of generic testimonials).
- **Eureka finding:** Every reference site assumes rich media/dense grids signal quality. For S@Learn's actual users (variable device/network), that weight is a tax on exactly the audience being served. Trust and "world-class" here come from restraint and real data, not from copying image/JS-heavy category patterns.

### Product Register (authenticated dashboards — added 2026-07-24)
- **Elevation:** `shadow-sm` resting / `shadow-md` on hover for cards (stat tiles, streak/XP
  card, course cards, sidebar active state), `rounded-xl` (12px) minimum, up from flat
  `border-canvas-150` with no shadow. This is the single biggest "flat vs. modern" gap versus
  the W3Schools reference.
- **Iconography:** real lucide-react icons for gamification — flame for streak, trophy for
  league tier, zap for XP/credits — reversing the 2026-07-23 "typographic-only" streak-tick
  decision now that the founder has clarified dashboards specifically should feel modern, not
  restrained. Still no emoji, no 3D badge art (matches the totem-mascot decision: real icons
  are fine, cartoon/emoji-heavy decoration is not).
- **Motion:** hover lift (`translate-y` + shadow increase) on interactive cards, animated
  progress-bar fill (`transition-[width]`) instead of a static bar, both within a slightly
  wider budget than the Editorial register's micro/short — up to ~300ms, still no
  scroll-driven or entrance-sequence choreography. Respects the same low-bandwidth
  constraint as the rest of the app: CSS transitions only, nothing that ships JS animation
  libraries or blocks on a network request.
- **Color:** reuses the existing gold/DM-Sans dashboard palette (`primary-*`, `green-*`) more
  confidently/liberally rather than introducing new hex values — e.g. `primary-500` becomes
  the default filled progress/active-state color throughout, not just on a couple of
  buttons. Verified Forest (`#1F5C4E`) stays reserved for the Editorial register's
  verification-stamp motif and is NOT reused here, so that motif keeps its scarcity/meaning.

**Revision — "pushed further" pass (2026-07-24):** founder wanted closer visual fidelity to
the actual Pathfinder reference screens, not just elevation/icons layered on the existing
gold palette. Superseding the Color bullet above: **green (Tailwind `green-500`/`green-600`/
`green-50`/`green-700`) is now the Product Register's primary/active accent** — sidebar
active state, gamification card accents, resume-course progress fill and CTA — matching the
reference's actual dominant color, not gold. Gold (`primary-*`) stays only where it's part of
an already-correct 3-color semantic set that green would collide with (the Not-started/
In-progress/Completed status badges and chart in `CourseStudents.tsx` — In-progress is gold,
Completed is green; making both green would make two of three states visually
indistinguishable, an accessibility regression, not an improvement). Also: `StreakXPCard`
restructured from one unified card into 3 separate cards (Totem/Avatar · Streak with a 7-day
flame strip · League with a progress-to-next-tier bar), mirroring the Pathfinder reference's
actual 3-card row layout instead of a single icon-tile summary; `DashboardSidebar` gained a
profile header (totem + name + tier pill) above the nav, mirroring the reference's
avatar+name+tier card at the top of its sidebar.

## Typography
- **Display/Hero:** Fraunces — warm, editorial serif with italic optical-size emphasis. Deliberately not another Playfair/generic-serif; carries the "considered, not corporate" feeling.
- **Body:** General Sans — humanist grotesk, light-weight on low-end devices, clean French accent support.
- **UI/Labels:** Same as body (General Sans).
- **Data/Tables:** IBM Plex Mono, tabular-nums — used for FCFA prices, exam scores, credit ledger entries, claim countdowns. Gives numeric data ledger-like precision.
- **Code:** IBM Plex Mono.
- **Loading:** Google Fonts CDN for Fraunces + IBM Plex Mono; Fontshare CDN for General Sans (`https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700`).
- **Scale:** Hero 52px/1.08 (36px mobile) · H2 28px · H3 19-20px · Body 15-16px · Small/mono labels 11-13px.

## Color
- **Approach:** Restrained — one warm accent, one trust color used only where verification is real, warm neutrals throughout (no cool grays, no pure black/white).
- **Primary:** Oxblood `#9C3B2E` (hover `#7C2E23`) — buttons, links, primary CTAs. Chosen over pure red to avoid "error/danger" connotation in a trust-sensitive booking context; chosen over amber (previous accent) for more editorial, less generic-SaaS feel.
- **Secondary:** Verified Forest `#1F5C4E` — used ONLY for the verification-stamp motif and success states tied to real verification events. Never used decoratively or as a general secondary color.
- **Neutrals:** Ink `#14171F` (text, dark surfaces), Paper `#F7F3EA` (background), warm gray `#8A8578` (secondary text), warm gray light `#D8D2C4` / border `#E4DDCC`.
- **Semantic:** success = Verified Forest `#1F5C4E`, error = Oxblood `#9C3B2E`, warning/info: reuse warm gray + ink at reduced opacity rather than introducing new hues — restraint applies to semantic colors too.
- **Dark mode:** Ink `#14171F` becomes the background, Paper-tinted `#F2EFE6` becomes text, raised surfaces `#1D212B`, border `#2B303C`. Oxblood and Verified Forest stay the same hex values in both modes (both already have enough contrast against both ink and paper).

## Spacing
- **Base unit:** 8px.
- **Density:** Comfortable — generous touch targets for mobile-first, lower-end-device usage. Not compact.
- **Scale:** 2xs(4) xs(8) sm(12) md(16) lg(24) xl(32) 2xl(48) 3xl(64).

## Layout
- **Approach:** Hybrid — grid-disciplined for course/tutor listings and dashboards (predictable 3-column card grids, sidebar+main dashboard layout), creative-editorial for marketing/hero sections (asymmetric hero split, real typographic hierarchy over generic centered blocks).
- **Grid:** 3 columns desktop for card listings, 1 column mobile (<860px). Dashboard: 220px sidebar + fluid main column, stacking on mobile.
- **Max content width:** 1120px.
- **Border radius:** sm 4px (tags, small controls), md 8px (buttons, inputs, cards), lg 12px (panels, card containers), full 999px (pills, stamp badge).

## Motion
- **Approach:** Minimal-functional — only transitions that aid comprehension (theme toggle, hover states, form validation). Deliberately restrained to respect data cost and device capability; this restraint IS part of the "built for us" promise, not a limitation to work around.
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out).
- **Duration:** micro(50-100ms) short(150-250ms) medium(250-400ms). Avoid long/expressive choreography entirely — no scroll-driven animation, no elaborate entrance sequences.

## Safe Choices (category baseline)
- Card-based listings for courses/tutors with clear price/category/rating info — scannable, matches user expectations from Coursera/Udemy exposure.
- Standard top-nav + search bar pattern.
- Light mode as default with a dark mode toggle.

## Deliberate Risks (where the product gets its own face)
1. **Ink-and-paper editorial aesthetic + Fraunces** instead of generic corporate-blue-SaaS (Coursera) or bubbly-friendly (Udemy-adjacent) — nobody else in this category owns "considered and credible." Cost: less immediately "familiar SaaS" on first glance.
2. **Verification-as-typographic-stamp**, tied to real marking-guide verification (`paper_solutions.verification_status`), instead of a generic green-checkmark trust badge every fintech/ed-tech uses. Cost: more custom design work than grabbing a stock icon.
3. **Deliberately minimal motion/decoration** even where competitors go image/animation-heavy. Cost: may feel "less flashy" on a fast connection or in a demo — the payoff is real on the actual target network conditions.

## Patterns (added 2026-07-23)
Founder shared reference screenshots (Coursera multi-audience nav, W3Schools gamification/Pathfinder dashboard, W3Schools Academy institutional pages). Decision: adopt the *structural/UX patterns* only — every pattern below is reskinned entirely into the existing ink-and-paper system. None of these introduce new colors, fonts, or motion beyond what's already defined above. See Deliberate Risks #1 and #3 — this addendum does not reverse either.

### Multi-audience nav
A thin utility row above the main header with exactly 4 tabs, mirroring the account-type tracks: **Individual | School & University | Business | Government**. "Individual" is the single tab covering the existing parent/student/tutor experience (no separate Parents/Tutors split) — matching how Coursera treats "For Individuals" as one track. Each tab routes to a positioning page for that account type. Style: Paper/Ink background, 11px IBM Plex Mono label caps, no color — the only accent is an Oxblood underline on the active tab. No pill buttons, no icons.

### Gamification (streaks / XP / leagues)
Keep the mechanic, drop the navy/purple/emoji treatment entirely. Streak = a row of small square ticks filled Oxblood (not fire icons). XP = a plain IBM Plex Mono number labeled "credits earned" (not a lightning-bolt stat card). League tier = a typographic label (Bronze/Silver/Gold as text), consistent with the existing verification-stamp motif. Motion stays inside the existing micro/short duration budget — no confetti, no animated counters.

### Student dashboard IA
Adopt the "continue where you left off" + progress-ring information architecture (left sidebar: Dashboard, My Progress, My Requests, Certificates, Profile) inside the existing 220px-sidebar dashboard grid — ink-and-paper cards, not dark tiles.

### Institutional pages (School & University / Business / Government tiers)
Adopt the value-props → pricing tiers → FAQ (incl. compliance) → analytics-preview page structure as the template for the 3 new account-type landing pages, built in the existing editorial/asymmetric marketing layout — not a dark corporate-SaaS treatment.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-17 | Initial design system created | Created by /design-consultation based on office-hours product context, live-app research (s-learn-beta.vercel.app), and competitive research (Preply, Flutterwave, Coursera). Replaces the prior amber/gold + green ad-hoc palette with a restrained ink/paper/oxblood/verified-forest system tied to the V3 verification mechanics. |
| 2026-07-23 | Added Patterns section (nav, gamification, dashboard IA, institutional pages) | Founder shared Coursera/W3Schools reference screenshots wanting that UI/UX adopted while keeping the ink-and-paper vision. Resolved as: adopt structure, re-skin entirely — no change to typography/color/motion tokens above. |
| 2026-07-23 | Nav corrected to 4 tabs (Individual / School & University / Business / Government); shipped nav + institutional marketing pages + gamification card | Founder corrected the nav proposal to merge Parents/Tutors into one "Individual" tab. Institutional pages scoped as marketing/interest-capture only (no new account types/RLS). Gamification scoped as personal XP/streak/tier derived from existing lesson/quiz data, not a competitive leaderboard (that needs its own privacy + cron scoping pass). Dashboard sidebar IA deliberately deferred — would restructure existing working navigation, flagged for a design pass instead of a silent call. |
| 2026-07-23 | Shipped dashboard sidebar IA, instructor classroom adaptation, avatar totem identity system | Founder confirmed the sidebar IA (scoped as shortcuts to existing pages, no duplicated IA, no fake "My Progress" tab). Instructor `CourseStudents.tsx` adapted to the shared "Slearn classroom.png" reference (attention panel + class-progress chart), styled in that page's existing old-token system for internal consistency, not ink-and-paper. Avatar mascots: African national-team nicknames (Cameroon's Indomitable Lions listed first). |
| 2026-07-23 | Totem avatars corrected from text-only to an emoji mascot badge | Founder explicitly rejected the text-only totem treatment, wanted a real mascot. Revised to a colored circular badge + animal/symbol emoji per totem (lion/eagle/elephant/star/etc.), since no image-generation capability exists here and real team crests are trademarked — this is the closest honest approximation to an illustrated mascot available in this environment. Deliberately NOT extended to the streak-tick gamification pattern, which stays icon-free per its own earlier decision (a different surface, not reopened here). |
| 2026-07-24 | Split into Editorial + Product registers; Product register gets elevation/icons/motion | Founder: current system is "good" but "lacks some major modern aspect," pointing at W3Schools' visual richness specifically (not its product model). Chose the hybrid scope (of 3 options presented): authenticated dashboards/gamification lean into modern elevation, real icons, and noticeable motion; booking flow + institutional marketing pages stay restrained/editorial, since that's where the "considered, credible" identity still does trust work. This explicitly reverses the 2026-07-23 "typographic-only, no icons" streak/XP decision for the Product register only — Editorial-register pages are unaffected. |
| 2026-07-24 | "Completely change my design" clarified to a deeper Product-register fidelity pass, not a full reversal | Founder's "completely change" was ambiguous between "everywhere" and "dashboards need to go further" — asked, founder chose the latter (recommended option), keeping the Editorial/Product split from earlier the same day. Green becomes the Product Register's primary accent (superseding the "reuse gold more liberally" color note above), except where it would collide with an already-correct 3-color semantic set (`CourseStudents`' status badges/chart). `StreakXPCard` restructured into 3 cards (Totem/Streak-with-week-strip/League-with-progress-bar) mirroring the Pathfinder reference's actual layout; `DashboardSidebar` gained a profile header card. |
| 2026-07-24 | "Keep my colors, change the entire design" — reverted the green accent, expanded elevation/motion to the whole public-facing app | Founder: nothing looked modified, and don't change colors. Root cause: the prior 2 passes only touched a handful of authenticated-student-dashboard files (`StudentDashboard`/`DashboardSidebar`/`StreakXPCard`/`CourseStudents`) — the vast majority of the app (`Header`, `HomePage`, `CourseList`, `CourseDetail`, `CourseCard`) hadn't been touched at all, so "nothing modified" was substantially true from a founder-browsing-the-site perspective. Fixed 2 things: (1) reverted the just-added green accent back to the original `primary-*` gold/`orange-*` (flame)/existing semantic colors — no new color introduced anywhere; (2) extended the elevation+hover-lift+animated-progress "Product Register" treatment to `Header` (nav pills, sign-in button), `HomePage` (category chips, "why choose" cards, instructor CTA), `CourseCard`/`CourseList` (chips, search bar, load-more), and `CourseDetail` (hero, lesson rows, instructor card, reviews, sticky enroll sidebar) — i.e. the whole public browsing path, not just the logged-in dashboard subset. |
