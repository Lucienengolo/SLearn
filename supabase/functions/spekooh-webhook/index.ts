// Spekooh calls this whenever apps.instructors.services.route_next_instructor
// (a "new_request" push) or the day-4/day-6 marking-guide reminder cron (a
// "guide_reminder" push) fires for one of our instructors. Deployed with
// --no-verify-jwt (same as stripe-webhook/cal-webhook) -- auth is the
// X-Spekooh-Signature HMAC header instead of a Supabase session, matching
// Spekooh's own apps.instructors.webhook.verify_webhook_request exactly:
// signed_payload = `${timestamp}.` + rawBody, hex HMAC-SHA256, header
// `sha256=<digest>`.
import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabaseAdmin.ts';

const SPEKOOH_WEBHOOK_SECRET = Deno.env.get('SPEKOOH_WEBHOOK_SECRET');
const MAX_SKEW_SECONDS = 300; // matches Spekooh's INSTRUCTOR_WEBHOOK_MAX_SKEW_SECONDS default

type NewRequestPayload = {
  event_type: 'new_request';
  instructor_request_id: number;
  instructor_id: string;
  paper_id: number;
  subject: string | null;
  sent_at: string;
  responds_by: string;
};

type GuideReminderPayload = {
  event_type: 'guide_reminder';
  instructor_request_id: number;
  instructor_id: string;
  paper_id: number;
  guide_deadline: string;
  day: number;
};

type WebhookBody = NewRequestPayload | GuideReminderPayload;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }
  if (!SPEKOOH_WEBHOOK_SECRET) {
    return json({ error: 'Spekooh integration is not configured on this deployment' }, 500);
  }

  const partnerId = req.headers.get('x-spekooh-partner-id');
  const signature = req.headers.get('x-spekooh-signature');
  const timestamp = req.headers.get('x-spekooh-timestamp');
  const rawBody = await req.text();

  if (!partnerId || !signature || !timestamp) {
    return json({ error: 'Missing required webhook headers' }, 401);
  }

  const skew = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(skew) || skew > MAX_SKEW_SECONDS) {
    return json({ error: 'Timestamp outside the allowed replay window' }, 401);
  }

  if (!(await verifySignature(timestamp, rawBody, signature, SPEKOOH_WEBHOOK_SECRET))) {
    return json({ error: 'Invalid signature' }, 401);
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const admin = createAdminClient();

  if (body.event_type === 'new_request') {
    const { error } = await admin.from('spekooh_marking_requests').upsert(
      {
        spekooh_request_id: body.instructor_request_id,
        spekooh_paper_id: body.paper_id,
        instructor_id: body.instructor_id,
        subject: body.subject,
        status: 'pending',
        sent_at: body.sent_at,
        responds_by: body.responds_by,
      },
      { onConflict: 'spekooh_request_id' }
    );
    if (error) return json({ error: `Failed to record marking request: ${error.message}` }, 500);
    return json({ ok: true });
  }

  if (body.event_type === 'guide_reminder') {
    const field = body.day === 4 ? 'day4_reminder_at' : 'day6_reminder_at';
    const { error } = await admin
      .from('spekooh_marking_requests')
      .update({ guide_deadline: body.guide_deadline, [field]: new Date().toISOString() })
      .eq('spekooh_request_id', body.instructor_request_id);
    if (error) return json({ error: `Failed to record reminder: ${error.message}` }, 500);
    return json({ ok: true });
  }

  return json({ ok: true, skipped: 'unknown event_type' });
});

async function verifySignature(
  timestamp: string,
  rawBody: string,
  signatureHeader: string,
  secret: string
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signedPayload = new TextEncoder().encode(`${timestamp}.${rawBody}`);
  const mac = await crypto.subtle.sign('HMAC', key, signedPayload);
  const computed = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return timingSafeEqual(`sha256=${computed}`, signatureHeader);
}

// Constant-time comparison so a webhook forger can't learn the secret via
// timing (same rationale as cal-webhook's own timingSafeEqual).
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
