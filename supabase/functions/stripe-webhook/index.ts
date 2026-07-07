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
  const studentId = session.metadata?.student_id;
  const courseId = session.metadata?.course_id;

  if (!studentId || !courseId) {
    return json({ ok: true, skipped: 'missing metadata' });
  }

  const admin = createAdminClient();

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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
