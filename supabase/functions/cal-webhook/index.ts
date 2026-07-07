// Cal.com calls this when a booking is created/cancelled/rescheduled for
// the instructor-interview event type. Deployed with --no-verify-jwt (same
// as stripe-webhook/notify-application-email) — auth is the
// X-Cal-Signature-256 HMAC header instead of a Supabase session.
//
// NOT yet verified against a real Cal.com webhook delivery (unlike the rest
// of this session's Supabase work, which was tested live) — there's no
// Cal.com account configured here to test against. The payload shape below
// matches Cal.com's documented webhook format (uid/startTime/attendees[]/
// videoCallData), but double-check field names against an actual test
// delivery (Cal.com dashboard → webhook → "Send test") once configured,
// and adjust here if anything doesn't line up.
import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabaseAdmin.ts';

const CAL_WEBHOOK_SECRET = Deno.env.get('CAL_WEBHOOK_SECRET');

type CalAttendee = { email: string; name?: string };
type CalBookingPayload = {
  uid: string;
  startTime: string;
  attendees?: CalAttendee[];
  videoCallData?: { url?: string };
  location?: string;
};
type CalWebhookBody = {
  triggerEvent: 'BOOKING_CREATED' | 'BOOKING_CANCELLED' | 'BOOKING_RESCHEDULED' | string;
  payload: CalBookingPayload;
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  if (!CAL_WEBHOOK_SECRET) {
    return json({ error: 'Cal.com integration is not configured on this deployment' }, 500);
  }

  const signature = req.headers.get('x-cal-signature-256');
  const rawBody = await req.text();

  if (!signature || !(await verifySignature(rawBody, signature, CAL_WEBHOOK_SECRET))) {
    return json({ error: 'Invalid signature' }, 401);
  }

  let body: CalWebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { triggerEvent, payload } = body;
  const attendeeEmail = payload?.attendees?.[0]?.email;
  if (!payload?.uid || !attendeeEmail) {
    return json({ ok: true, skipped: 'missing uid or attendee email' });
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', attendeeEmail)
    .maybeSingle();

  if (!profile) {
    return json({ ok: true, skipped: 'no profile matches attendee email' });
  }

  // Only an application still in progress can have its interview touched —
  // once approved/rejected, a stray Cal.com event shouldn't reopen it.
  const { data: application } = await admin
    .from('instructor_applications')
    .select('id, status')
    .eq('applicant_id', profile.id)
    .in('status', ['submitted', 'review', 'interview'])
    .maybeSingle();

  if (!application) {
    return json({ ok: true, skipped: 'no in-progress application for this applicant' });
  }

  if (triggerEvent === 'BOOKING_CANCELLED') {
    const { error } = await admin
      .from('interviews')
      .update({ outcome: 'rescheduled' })
      .eq('cal_booking_uid', payload.uid);
    if (error) return json({ error: `Failed to record cancellation: ${error.message}` }, 500);
    return json({ ok: true });
  }

  const meetingUrl = payload.videoCallData?.url ?? payload.location ?? null;

  const { data: existing } = await admin
    .from('interviews')
    .select('id')
    .eq('cal_booking_uid', payload.uid)
    .maybeSingle();

  if (existing) {
    // BOOKING_RESCHEDULED for a booking we already recorded.
    const { error } = await admin
      .from('interviews')
      .update({ scheduled_at: payload.startTime, meeting_url: meetingUrl })
      .eq('id', existing.id);
    if (error) return json({ error: `Failed to update interview: ${error.message}` }, 500);
    return json({ ok: true });
  }

  // A fresh booking (BOOKING_CREATED). The interviews_notify_scheduled
  // trigger (0004/0011) fires on this insert and queues the
  // "your interview is scheduled" email — nothing to do here for that.
  const { error: insertError } = await admin.from('interviews').insert({
    application_id: application.id,
    scheduled_at: payload.startTime,
    cal_booking_uid: payload.uid,
    meeting_url: meetingUrl,
  });

  if (insertError) {
    return json({ error: `Failed to record interview: ${insertError.message}` }, 500);
  }

  if (application.status !== 'interview') {
    await admin.from('instructor_applications').update({ status: 'interview' }).eq('id', application.id);
  }

  return json({ ok: true });
});

async function verifySignature(rawBody: string, signatureHeader: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const computed = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return timingSafeEqual(computed, signatureHeader);
}

// Cal.com sends the signature as a lowercase hex digest — constant-time
// comparison so a webhook forger can't learn the secret via timing.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
