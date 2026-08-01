// Shared FCFA formatter (founder decision, 2026-08-01, Batch 2 of the
// beta-readiness roadmap) -- course prices were displayed with a hardcoded
// "$" even though this is a Cameroon-focused platform. Mirrors the
// Intl.NumberFormat('fr-FR') pattern already used in PaymentStatus.tsx for
// tutor-marketplace payments (which were already correctly denominated in
// FCFA); extracted here so CourseCard/CourseDetail don't each redefine it.
const FCFA = new Intl.NumberFormat('fr-FR');

export function formatFCFA(amount: number): string {
  return `${FCFA.format(Math.round(amount))} FCFA`;
}
