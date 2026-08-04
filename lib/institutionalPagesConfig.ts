// Institutional pages kill-switch (founder decision, 2026-08-04). The
// School/Business/Government tracks (InstitutionalLandingPage.tsx) show a
// maintenance notice instead of their real content while this is false.
// Same pattern as paymentsConfig.ts's PAYMENTS_ENABLED -- a separate module
// so it's independently mockable in tests, and flipping it back on is a
// one-line change, not a rewrite.
export const INSTITUTIONAL_PAGES_ENABLED = false;
