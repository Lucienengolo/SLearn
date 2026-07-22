// Stripe calls this directly (server-to-server, no Supabase session) —
// deployed with --no-verify-jwt, same as notify-application-email. Auth is
// the Stripe-Signature header instead, verified against STRIPE_WEBHOOK_SECRET.
// This is the ONLY place an enrollments row is created for a paid course
// (see 0009_payments.sql's RLS policy, which blocks a client from creating
// one directly).
import Stripe from 'stripe';
import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabaseAdmin.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!stripeKey || !webhookSecret) {
    return json({ error: 'Payments are not configured on this deployment' }, 500);
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return json({ error: 'Missing stripe-signature header' }, 400);
  }

  // Signature verification needs the exact raw bytes Stripe signed — never
  // req.json() here, which would re-serialize and break the signature check.
  const rawBody = await req.text();

  const stripe = new Stripe(stripeKey, { httpClient: Stripe.createFetchHttpClient() });

  let event: Stripe.Event;
  try {
    // constructEventAsync + the SubtleCrypto provider: Deno doesn't expose
    // Node's `crypto` module the way Stripe's default sync verification
    // expects, so this is Stripe's own documented pattern for edge runtimes.
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
      undefined,
      Stripe.createSubtleCryptoProvider()
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Signature verification failed';
    return json({ error: `Webhook signature verification failed: ${message}` }, 400);
  }

  if (event.type !== 'checkout.session.completed') {
    return json({ ok: true, skipped: event.type });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const admin = createAdminClient();

  // Tutor-marketplace deposit checkout (create-tutor-deposit-checkout) --
  // handled first and returns early, entirely additive: the course-payment
  // path below is untouched and still runs for every session that isn't
  // tagged with this metadata.
  if (session.metadata?.kind === 'tutor_deposit') {
    return await handleTutorDepositCompleted(admin, session);
  }

  const studentId = session.metadata?.student_id;
  const courseId = session.metadata?.course_id;

  if (!studentId || !courseId) {
    return json({ ok: true, skipped: 'missing metadata' });
  }

  // Idempotent: Stripe retries webhooks on anything but a 2xx response, and
  // may also just send the same event twice. A payment already marked
  // completed means a previous delivery already handled this session.
  const { data: payment } = await admin
    .from('payments')
    .select('status')
    .eq('stripe_checkout_session_id', session.id)
    .maybeSingle();

  if (payment?.status === 'completed') {
    return json({ ok: true, skipped: 'already processed' });
  }

  const { error: updateError } = await admin
    .from('payments')
    .update({
      status: 'completed',
      stripe_payment_intent_id:
        typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent?.id ?? null),
      completed_at: new Date().toISOString(),
    })
    .eq('stripe_checkout_session_id', session.id);

  if (updateError) {
    return json({ error: `Failed to update payment: ${updateError.message}` }, 500);
  }

  // on_conflict matches the enrollments(student_id, course_id) unique
  // constraint from 0001_core_schema.sql — safe against duplicate delivery.
  const { error: enrollError } = await admin
    .from('enrollments')
    .upsert({ student_id: studentId, course_id: courseId }, { onConflict: 'student_id,course_id', ignoreDuplicates: true });

  if (enrollError) {
    return json({ error: `Payment recorded but enrollment failed: ${enrollError.message}` }, 500);
  }

  return json({ ok: true });
});

async function handleTutorDepositCompleted(
  admin: ReturnType<typeof createAdminClient>,
  session: Stripe.Checkout.Session
): Promise<Response> {
  const matchId = session.metadata?.match_id;
  if (!matchId) {
    return json({ ok: true, skipped: 'missing match_id metadata' });
  }

  // Idempotent, same reasoning as the course-payment path above: Stripe may
  // deliver this event more than once.
  const { data: payment } = await admin
    .from('tutor_session_payments')
    .select('deposit_status')
    .eq('stripe_checkout_session_id', session.id)
    .maybeSingle();

  if (payment?.deposit_status === 'paid') {
    return json({ ok: true, skipped: 'already processed' });
  }

  const paymentIntentId =
    typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent?.id ?? null);

  const { error: updatePaymentError } = await admin
    .from('tutor_session_payments')
    .update({ deposit_status: 'paid', stripe_payment_intent_id: paymentIntentId })
    .eq('stripe_checkout_session_id', session.id);

  if (updatePaymentError) {
    return json({ error: `Failed to update tutor deposit payment: ${updatePaymentError.message}` }, 500);
  }

  // Guarded on status='messaging' so this can't clobber a match that a race
  // (or a stale retried webhook) already moved past deposit_paid.
  const { error: updateMatchError } = await admin
    .from('matches')
    .update({ status: 'deposit_paid', deposit_paid_at: new Date().toISOString() })
    .eq('id', matchId)
    .eq('status', 'messaging');

  if (updateMatchError) {
    return json({ error: `Deposit recorded but match update failed: ${updateMatchError.message}` }, 500);
  }

  return json({ ok: true });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
