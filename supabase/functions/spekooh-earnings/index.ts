// An instructor's Spekooh earnings: credit balance, per-paper credit history
// and payout status. Spekooh owns the ledger and the withdrawals, so this
// asks it live over the same HMAC channel as spekooh-respond rather than
// keeping a second copy here that could disagree.
//
// Call with: POST {}  (Authorization: Bearer <instructor JWT>)
// The instructor id sent to Spekooh is always the authenticated caller's.
import { corsHeaders } from '../_shared/cors.ts';
import { createCallerClient } from '../_shared/supabaseAdmin.ts';
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
  const url = partnerApiUrl(SPEKOOH_WEBHOOK_URL, 'earnings');
  if (!url || !SPEKOOH_WEBHOOK_SECRET) {
    return json({ error: 'Spekooh integration is not configured on this deployment' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Missing Authorization header' }, 401);
  }

  const { data: userData, error: userError } = await createCallerClient(authHeader).auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'Invalid or expired session' }, 401);
  }

  let result;
  try {
    result = await callPartner({
      url,
      partnerId: SPEKOOH_PARTNER_ID,
      secret: SPEKOOH_WEBHOOK_SECRET,
      payload: { instructor_id: userData.user.id },
    });
  } catch (err) {
    return json({ error: `Could not reach Spekooh: ${err instanceof Error ? err.message : String(err)}` }, 502);
  }

  if (result.status !== 200) {
    return json({ error: 'Spekooh could not provide your earnings', detail: result.body }, 502);
  }
  return json(result.body);
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
