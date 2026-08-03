// V1 payment kill-switch (founder decision, 2026-08-01, Batch 2 of the
// beta-readiness roadmap -- see ~/.claude/plans/mighty-booping-tiger.md).
// Real payment processing isn't a viable channel yet: course purchases
// charge real USD via Stripe (a poor fit for this market), and local
// Mobile Money integration doesn't exist. Rather than hide the payment
// buttons, they stay visible (founder's explicit instruction) but clicking
// them shows an informational message instead of redirecting to Stripe.
//
// This flag gates the CLIENT -- it stops the checkout button from ever
// calling the edge functions. create-checkout-session and
// create-tutor-deposit-checkout each carry a matching server-side
// PAYMENTS_ENABLED = false (2026-08-02 security review), so a direct API
// call bypassing the UI can't start a real Stripe checkout either. Flip
// all three together (this constant + both edge functions, then redeploy
// the functions) when payments actually go live.
export const PAYMENTS_ENABLED = false;
