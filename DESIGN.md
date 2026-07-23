# Design System — S@Learn

## Product Context
- **What this is:** S@Learn ("Store of Learning"), an online learning and tutor marketplace launching in Douala, Cameroon.
- **Who it's for:** Parents booking verified tutors for their children, students becoming tutors, students uploading/buying access to solved past exam papers. Users span a wide range of device capability, network conditions, and tech literacy.
- **Space/industry:** Ed-tech / two-sided marketplace, pivoting from a generic course catalog (Coursera/Udemy-style) toward tutor booking + an exam-paper economy.
- **Project type:** Web app (React 18 + Vite + Tailwind + Supabase), marketing pages + authenticated dashboards.

## Memorable Thing
**"World-class, built for us."** Not a stripped-down African version of a Western product — genuinely polished and globally credible, with local specificity (FCFA pricing, French-first copy, real local exam systems, verified-tutor trust) coming through content, not decorative "African" visual motifs.

## Aesthetic Direction
- **Direction:** Editorial/Magazine, restrained — "ink-and-paper" credibility. A well-made gradebook, not a generic SaaS dashboard.
- **Decoration level:** Intentional — a verification-stamp motif used only where verification is real (tied directly to `paper_solutions.verification_status`), never as decoration. No stock photography, no gradient hero, no animation-heavy imagery.
- **Mood:** Considered, credible, quietly confident. Trust comes from typographic craft and real verified data, not from decoration or media weight.
- **Reference sites:** Preply (tutor-marketplace trust patterns — deliberately NOT adopting its stock-photo hero), Flutterwave (proof that African-built products can be genuinely global-caliber), Coursera (outcome-stat-as-trust-device, adapted to real verification data instead of generic testimonials).
- **Eureka finding:** Every reference site assumes rich media/dense grids signal quality. For S@Learn's actual users (variable device/network), that weight is a tax on exactly the audience being served. Trust and "world-class" here come from restraint and real data, not from copying image/JS-heavy category patterns.

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
