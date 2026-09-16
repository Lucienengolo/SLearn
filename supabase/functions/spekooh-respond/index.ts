// Instructor-facing half of the Spekooh integration: called from the
// instructor's own authenticated session (Authorization: Bearer <JWT>) to
// accept/reject a routed paper or submit its marking guide. Signs and posts
// to Spekooh's own inbound webhook (apps.instructors.webhook.verify_webhook_
// request) with the same shared secret spekooh-webhook verifies inbound
// pushes with, then updates our own row only after Spekooh confirms it
// applied the change -- so our state can never drift ahead of Spekooh's.
//
// Call with: POST { spekooh_request_id, action: 'respond', decision: 'ACCEPTED' | 'REJECTED' }
//         or POST { spekooh_request_id, action: 'submit_guide', content: [...] }
import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient, createCallerClient } from '../_shared/supabaseAdmin.ts';

const SPEKOOH_WEBHOOK_URL = Deno.env.get('SPEKOOH_WEBHOOK_URL');
const SPEKOOH_WEBHOOK_SECRET = Deno.env.get('SPEKOOH_WEBHOOK_SECRET');
const SPEKOOH_PARTNER_ID = Deno.env.get('SPEKOOH_PARTNER_ID') ?? 's-learn';

type RespondBody = { spekooh_request_id: number; action: 'respond'; decision: 'ACCEPTED' | 'REJECTED' };
type SubmitGuideBody = {
  spekooh_request_id: number;
  action: 'submit_guide';
  content: { question_type: string; text?: string; answer?: string }[];
};
type RequestBody = RespondBody | SubmitGuideBody;

function isRequestBody(value: unknown): value is RequestBody {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.spekooh_request_id !== 'number') return false;
  if (v.action === 'respond') return v.decision === 'ACCEPTED' || v.decision === 'REJECTED';
  if (v.action === 'submit_guide') return Array.isArray(v.content);
  return false;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }
  if (!SPEKOOH_WEBHOOK_URL || !SPEKOOH_WEBHOOK_SECRET) {
    return json({ error: 'Spekooh integration is not configured on this deployment' }, 500);
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
    return json({ error: "Expected { spekooh_request_id, action: 'respond' | 'submit_guide', ... }" }, 400);
  }

  const admin = createAdminClient();
  const caller = createCallerClient(authHeader);

  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'Invalid or expired session' }, 401);
  }

  // Ownership check happens here, not by trusting the caller's own claim --
  // a row this instructor doesn't own is treated identically to one that
  // doesn't exist.
  const { data: row } = await admin
    .from('spekooh_marking_requests')
    .select('id, status, instructor_id')
    .eq('spekooh_request_id', body.spekooh_request_id)
    .eq('instructor_id', userData.user.id)
    .maybeSingle();

  if (!row) {
    return json({ error: 'No matching marking request for this account' }, 404);
  }

  const eventType = body.action === 'respond' ? 'instructor_response' : 'marking_guide_submission';
  const payload =
    body.action === 'respond'
      ? { event_type: eventType, instructor_request_id: body.spekooh_request_id, decision: body.decision }
      : { event_type: eventType, instructor_request_id: body.spekooh_request_id, content: body.content };

  const rawBody = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = await signPayload(timestamp, rawBody, SPEKOOH_WEBHOOK_SECRET);

  let spekoohResponse: Response;
  try {
    spekoohResponse = await fetch(SPEKOOH_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Spekooh-Partner-Id': SPEKOOH_PARTNER_ID,
        'X-Spekooh-Timestamp': timestamp,
        'X-Spekooh-Signature': signature,
      },
      body: rawBody,
    });
  } catch (err) {
    return json({ error: `Could not reach Spekooh: ${err instanceof Error ? err.message : String(err)}` }, 502);
  }

  const spekoohResult = await spekoohResponse.json().catch(() => ({}));
  if (!spekoohResponse.ok || spekoohResult?.applied === false) {
    return json({ error: 'Spekooh rejected the update', detail: spekoohResult }, 409);
  }

  const update =
    body.action === 'respond'
      ? { status: body.decision === 'ACCEPTED' ? 'accepted' : 'rejected' }
      : { status: 'submitted', content: body.content };

  const { error: updateError } = await admin.from('spekooh_marking_requests').update(update).eq('id', row.id);
  if (updateError) {
    // Spekooh already applied the change at this point -- a local write
    // failure here is a display-staleness bug, not a data-integrity one.
    return json({ ok: true, warning: `Applied on Spekooh but failed to sync locally: ${updateError.message}` });
  }

  return json({ ok: true });
});

async function signPayload(timestamp: string, rawBody: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signedPayload = new TextEncoder().encode(`${timestamp}.${rawBody}`);
  const mac = await crypto.subtle.sign('HMAC', key, signedPayload);
  const hex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `sha256=${hex}`;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
