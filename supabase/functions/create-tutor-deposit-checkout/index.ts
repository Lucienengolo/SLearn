// Starts a Stripe Checkout session for a tutor booking's deposit (CEO plan
// item 5: 20% of the tutor's per-session rate). Separate from
// create-checkout-session (course payments) -- different table
// (tutor_session_payments, not payments), different currency handling
// (XAF is zero-decimal, see below), never touches the V1 course-payment path.
//
// Call with: POST { matchId, origin }, Authorization: Bearer <parent's JWT>
import Stripe from 'stripe';
import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient, createCallerClient } from '../_shared/supabaseAdmin.ts';

type RequestBody = { matchId: string; origin: string };

function isRequestBody(value: unknown): value is RequestBody {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.matchId === 'string' && typeof v.origin === 'string';
}

const DEPOSIT_RATE = 0.2;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Sign in to pay a deposit' }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  if (!isRequestBody(body)) {
    return json({ error: 'Expected { matchId, origin }' }, 400);
  }

  const allowedOrigins = (Deno.env.get('ALLOWED_CHECKOUT_ORIGINS') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (!allowedOrigins.includes(body.origin)) {
    return json({ error: 'Origin not allowed' }, 400);
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeKey) {
    return json({ error: 'Payments are not configured on this deployment' }, 500);
  }

  const admin = createAdminClient();
  const caller = createCallerClient(authHeader);

  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'Invalid or expired session' }, 401);
  }

  // RLS ("parents view matches tied to their own requests") enforces
  // ownership -- a parent can't start a checkout for someone else's match.
  const { data: match, error: matchError } = await caller
    .from('matches')
    .select('id, tutor_id, status')
    .eq('id', body.matchId)
    .maybeSingle();

  if (matchError || !match) {
    return json({ error: 'Booking not found' }, 404);
  }
  if (match.status !== 'messaging') {
    return json({ error: `Cannot start a deposit checkout for a booking in status ${match.status}` }, 409);
  }

  const { data: tutorFields, error: fieldsError } = await admin
    .from('tutor_profile_fields')
    .select('rate_per_session')
    .eq('tutor_id', match.tutor_id)
    .maybeSingle();

  if (fieldsError || !tutorFields) {
    return json({ error: 'Tutor rate not found' }, 500);
  }

  // Rounded to whole FCFA -- XAF is a Stripe zero-decimal currency (see
  // unit_amount below), so fractional amounts have no meaning here anyway.
  const depositAmount = Math.round(tutorFields.rate_per_session * DEPOSIT_RATE);
  const balanceAmount = tutorFields.rate_per_session - depositAmount;

  // Idempotent against a repeat click: an existing 'paid' deposit means
  // checkout already succeeded -- don't let a parent pay twice.
  const { data: existingPayment } = await admin
    .from('tutor_session_payments')
    .select('deposit_status')
    .eq('match_id', match.id)
    .maybeSingle();
  if (existingPayment?.deposit_status === 'paid') {
    return json({ error: 'Deposit already paid for this booking' }, 400);
  }

  const stripe = new Stripe(stripeKey, { httpClient: Stripe.createFetchHttpClient() });

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'xaf',
          product_data: { name: 'Acompte de réservation tuteur' },
          // XAF is zero-decimal (like JPY) -- unlike create-checkout-session's
          // USD path, unit_amount here is the actual FCFA integer, NOT
          // multiplied by 100. Getting this wrong would over/undercharge by
          // a factor of 100.
          unit_amount: depositAmount,
        },
        quantity: 1,
      },
    ],
    success_url: `${body.origin}/?checkout=success#tutor-match-${match.id}`,
    cancel_url: `${body.origin}/?checkout=cancel#tutor-match-${match.id}`,
    client_reference_id: userData.user.id,
    metadata: { kind: 'tutor_deposit', match_id: match.id },
  });

  if (!session.url) {
    return json({ error: 'Stripe did not return a checkout URL' }, 500);
  }

  // Upsert, not insert -- tutor_session_payments.match_id is unique, and a
  // parent retrying an earlier abandoned checkout should reuse this row,
  // not fail on a duplicate-key violation.
  const { error: upsertError } = await admin.from('tutor_session_payments').upsert(
    {
      match_id: match.id,
      deposit_amount: depositAmount,
      balance_amount: balanceAmount,
      deposit_status: 'pending',
      stripe_checkout_session_id: session.id,
    },
    { onConflict: 'match_id' }
  );

  if (upsertError) {
    return json({ error: `Failed to record payment: ${upsertError.message}` }, 500);
  }

  return json({ url: session.url });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
