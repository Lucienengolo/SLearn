// Starts a Stripe Checkout session for a paid course. Never called for free
// courses (price = 0) — those still self-enroll directly (see the RLS policy
// in 0009_payments.sql, which enforces this at the DB layer too, not just
// here). The actual enrollments row is created by stripe-webhook once Stripe
// confirms payment, not by this function — this only starts the payment.
import Stripe from 'stripe';
import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient, createCallerClient } from '../_shared/supabaseAdmin.ts';

type RequestBody = {
  courseId: string;
  origin: string;
};

function isRequestBody(value: unknown): value is RequestBody {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.courseId === 'string' && typeof v.origin === 'string';
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
    return json({ error: 'Sign in to enroll' }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!isRequestBody(body)) {
    return json({ error: 'Expected { courseId, origin }' }, 400);
  }

  // Only allow redirecting back to an origin we actually serve from —
  // otherwise a caller could point success_url/cancel_url anywhere.
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
  const userId = userData.user.id;

  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (profile?.role !== 'student') {
    return json({ error: 'Only student accounts can enroll in courses' }, 403);
  }

  // Fetched with the caller's own JWT: RLS already guarantees this is a
  // real, published course (courses SELECT policy), not an admin-client
  // shortcut around that check.
  const { data: course, error: courseError } = await caller
    .from('courses')
    .select('id, title, price, is_published')
    .eq('id', body.courseId)
    .maybeSingle();

  if (courseError || !course) {
    return json({ error: 'Course not found' }, 404);
  }
  if (!course.is_published) {
    return json({ error: 'This course is not available' }, 400);
  }
  if (course.price <= 0) {
    return json({ error: 'This course is free — enroll directly instead of checking out' }, 400);
  }

  const { data: existingEnrollment } = await admin
    .from('enrollments')
    .select('id')
    .eq('student_id', userId)
    .eq('course_id', course.id)
    .maybeSingle();
  if (existingEnrollment) {
    return json({ error: 'Already enrolled in this course' }, 400);
  }

  const stripe = new Stripe(stripeKey);

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: { name: course.title },
          unit_amount: Math.round(course.price * 100),
        },
        quantity: 1,
      },
    ],
    // Query string must come before the hash fragment: this app routes on
    // window.location.hash (see App.tsx), so `#course-<id>?checkout=...`
    // would corrupt the courseId it parses out of the hash.
    success_url: `${body.origin}/?checkout=success#course-${course.id}`,
    cancel_url: `${body.origin}/?checkout=cancel#course-${course.id}`,
    client_reference_id: userId,
    metadata: { student_id: userId, course_id: course.id },
  });

  if (!session.url) {
    return json({ error: 'Stripe did not return a checkout URL' }, 500);
  }

  const { error: insertError } = await admin.from('payments').insert({
    student_id: userId,
    course_id: course.id,
    stripe_checkout_session_id: session.id,
    amount: course.price,
    currency: 'usd',
    status: 'pending',
  });

  if (insertError) {
    return json({ error: `Failed to record payment: ${insertError.message}` }, 500);
  }

  return json({ url: session.url });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
