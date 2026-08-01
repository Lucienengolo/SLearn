// V1 payment kill-switch (founder decision, 2026-08-01, Batch 2 of the
// beta-readiness roadmap -- see ~/.claude/plans/mighty-booping-tiger.md).
// Real payment processing isn't a viable channel yet: course purchases
// charge real USD via Stripe (a poor fit for this market), and local
// Mobile Money integration doesn't exist. Rather than hide the payment
// buttons, they stay visible (founder's explicit instruction) but clicking
// them shows an informational message instead of redirecting to Stripe.
//
// This flag gates the CLIENT only -- it stops the checkout button from
// ever calling the edge functions, but doesn't harden create-checkout-session
// or create-tutor-deposit-checkout themselves against a direct call. That
// server-side hardening is a real follow-up (tracked in TODOS.md) that
// needs an edge-function redeploy this session doesn't have fresh
// deploy credentials for -- flagged rather than silently left undone.
export const PAYMENTS_ENABLED = false;
