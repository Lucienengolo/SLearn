// Gives an instructor a fresh link to the paper they were asked to mark.
//
// The link Spekooh pushed inside `new_request` is a signed storage link that
// expires within the hour, but an instructor has days to respond, so it was
// dead by the time anyone opened it. Instead, every time the paper is opened
// this asks Spekooh for a new short-lived one, over the same HMAC channel as
// spekooh-respond.
//
// Call with: POST { spekooh_request_id }  (Authorization: Bearer <instructor JWT>)
// Returns:   { url, expires_in, file_name, content_type, request_status }
import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient, createCallerClient } from '../_shared/supabaseAdmin.ts';
import { callPartner, partnerApiUrl } from '../_shared/spekoohPartner.ts';

const SPEKOOH_WEBHOOK_URL = Deno.env.get('SPEKOOH_WEBHOOK_URL');
const SPEKOOH_WEBHOOK_SECRET = Deno.env.get('SPEKOOH_WEBHOOK_SECRET');
const SPEKOOH_PARTNER_ID = Deno.env.get('SPEKOOH_PARTNER_ID') ?? 's-learn';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }
  const url = partnerApiUrl(SPEKOOH_WEBHOOK_URL, 'paper-link');
  if (!url || !SPEKOOH_WEBHOOK_SECRET) {
    return json({ error: 'Spekooh integration is not configured on this deployment' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Missing Authorization header' }, 401);
  }

  let body: { spekooh_request_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  if (typeof body.spekooh_request_id !== 'number') {
    return json({ error: 'Expected { spekooh_request_id: number }' }, 400);
  }

  const { data: userData, error: userError } = await createCallerClient(authHeader).auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'Invalid or expired session' }, 401);
  }

  // Ownership is checked here against our own row, so a request that belongs
  // to someone else is indistinguishable from one that does not exist. The
  // instructor id sent to Spekooh is always the authenticated caller's,
  // never something the client supplied.
  const { data: row } = await createAdminClient()
    .from('spekooh_marking_requests')
    .select('id')
    .eq('spekooh_request_id', body.spekooh_request_id)
    .eq('instructor_id', userData.user.id)
    .maybeSingle();
  if (!row) {
    return json({ error: 'No matching marking request for this account' }, 404);
  }

  let result;
  try {
    result = await callPartner({
      url,
      partnerId: SPEKOOH_PARTNER_ID,
      secret: SPEKOOH_WEBHOOK_SECRET,
      payload: { instructor_request_id: body.spekooh_request_id, instructor_id: userData.user.id },
    });
  } catch (err) {
    return json({ error: `Could not reach Spekooh: ${err instanceof Error ? err.message : String(err)}` }, 502);
  }

  if (result.status === 200) return json(result.body);
  // 410 is a normal outcome (the request was closed or timed out on
  // Spekooh's side while our copy still shows it open), so it passes through
  // as-is for the UI to explain rather than being flattened into a 502.
  if (result.status === 404 || result.status === 410) {
    return json({ error: 'This paper is no longer available', detail: result.body }, result.status);
  }
  return json({ error: 'Spekooh could not provide the paper', detail: result.body }, 502);
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
