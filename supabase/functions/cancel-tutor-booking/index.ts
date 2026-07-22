// Parent-initiated cancellation of a deposit-paid tutor booking (CEO plan
// item 5, Row 20). Only callable from status='deposit_paid' -- the plan's
// state diagrams only show cancellation from that state, not from
// in_progress/completed.
//
// Call with: POST { matchId }, Authorization: Bearer <parent's JWT>
import Stripe from 'stripe';
import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient, createCallerClient } from '../_shared/supabaseAdmin.ts';
import { decideCancellationPath, attemptRefundWithRetry } from './cancellation.ts';

type RequestBody = { matchId: string };

function isRequestBody(value: unknown): value is RequestBody {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.matchId === 'string';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Missing Authorization header' }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  if (!isRequestBody(body)) {
    return json({ error: 'Expected { matchId }' }, 400);
  }

  const admin = createAdminClient();
  const caller = createCallerClient(authHeader);

  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'Invalid or expired session' }, 401);
  }

  // RLS ("parents view matches tied to their own requests") enforces
  // ownership here -- a parent cannot cancel someone else's booking.
  const { data: match, error: matchError } = await caller
    .from('matches')
    .select('id, status, confirmed_session_date')
    .eq('id', body.matchId)
    .maybeSingle();

  if (matchError || !match) {
    return json({ error: 'Booking not found' }, 404);
  }
  if (match.status !== 'deposit_paid') {
    return json({ error: `Cannot cancel a booking in status ${match.status}` }, 409);
  }

  const { data: payment, error: paymentError } = await admin
    .from('tutor_session_payments')
    .select('stripe_payment_intent_id')
    .eq('match_id', match.id)
    .maybeSingle();

  if (paymentError || !payment?.stripe_payment_intent_id) {
    return json({ error: 'No payment record found for this booking' }, 500);
  }

  const path = decideCancellationPath(match.confirmed_session_date, new Date());

  if (path === 'dispute_review') {
    return await routeToDisputeReview(admin, match.id, null);
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeKey) {
    return json({ error: 'Payments are not configured on this deployment' }, 500);
  }
  const stripe = new Stripe(stripeKey, { httpClient: Stripe.createFetchHttpClient() });

  const outcome = await attemptRefundWithRetry(async () => {
    try {
      await stripe.refunds.create({ payment_intent: payment.stripe_payment_intent_id! });
      return { outcome: 'succeeded' };
    } catch (err) {
      return { outcome: 'failed', message: err instanceof Error ? err.message : 'Refund failed' };
    }
  });

  if (outcome.succeeded) {
    const now = new Date().toISOString();
    const { error: updatePaymentError } = await admin
      .from('tutor_session_payments')
      .update({ cancellation_status: 'cancelled_refunded', refund_status: 'succeeded', cancelled_at: now })
      .eq('match_id', match.id);
    if (updatePaymentError) {
      return json({ error: `Refunded but failed to update payment record: ${updatePaymentError.message}` }, 500);
    }

    const { error: updateMatchError } = await admin
      .from('matches')
      .update({ status: 'cancelled_refunded', cancelled_at: now })
      .eq('id', match.id);
    if (updateMatchError) {
      return json({ error: `Refunded but failed to update match: ${updateMatchError.message}` }, 500);
    }

    return json({ path: 'cancelled_refunded' });
  }

  // Refund failed twice -- route to staff dispute queue rather than
  // silently failing (Error & Rescue Registry).
  const { error: refundFailedError } = await admin
    .from('tutor_session_payments')
    .update({ cancellation_status: 'dispute_review', refund_status: 'failed' })
    .eq('match_id', match.id);
  if (refundFailedError) {
    return json({ error: `Refund failed and payment record update also failed: ${refundFailedError.message}` }, 500);
  }

  return await routeToDisputeReview(admin, match.id, outcome.message);
});

async function routeToDisputeReview(
  admin: ReturnType<typeof createAdminClient>,
  matchId: string,
  refundFailureMessage: string | null
): Promise<Response> {
  const { error: updateMatchError } = await admin
    .from('matches')
    .update({ status: 'dispute_review', cancelled_at: new Date().toISOString() })
    .eq('id', matchId);
  if (updateMatchError) {
    return json({ error: `Failed to route to dispute review: ${updateMatchError.message}` }, 500);
  }

  // Only set cancellation_status here for the within-24h path -- the
  // refund-failed path already set it (with refund_status='failed') before
  // calling this helper, and re-setting it here would clobber that context.
  if (refundFailureMessage === null) {
    await admin.from('tutor_session_payments').update({ cancellation_status: 'dispute_review' }).eq('match_id', matchId);
  }

  const { data: reviewers } = await admin.from('profiles').select('id').eq('is_reviewer', true);
  if (reviewers && reviewers.length > 0) {
    await admin.from('notifications').insert(
      reviewers.map((r) => ({
        user_id: r.id,
        title: 'Booking cancellation needs review',
        body: refundFailureMessage
          ? `Match ${matchId}: refund failed twice (${refundFailureMessage}), needs manual handling.`
          : `Match ${matchId}: cancelled within 24h of the session, needs manual review.`,
        link: `admin/matches/${matchId}`,
      }))
    );
  }

  return json({ path: 'dispute_review' });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
