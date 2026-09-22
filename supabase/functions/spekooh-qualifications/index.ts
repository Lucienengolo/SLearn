// Lets an instructor state which of Spekooh's own education-level
// categories (primary/secondary/university/...) they're qualified to mark,
// and pushes that to Spekooh so its own routing can filter on it (see
// apps.instructors.services.upsert_instructor_profile) — fixing a real gap
// where a paper was routed by subject alone, with no qualification check.
//
// Call with: POST { action: 'list_categories' }
//   -> { categories: [{ key, title }] }, Spekooh's own live list, so the
//      picker UI can never drift out of sync with what Spekooh accepts.
// Call with: POST { action: 'save', qualified_categories: string[] }
//   -> validates against that same live list, saves locally, then pushes
//      an instructor_profile_update event to Spekooh over the existing
//      HMAC channel (same scheme as spekooh-respond).
// Both require Authorization: Bearer <instructor JWT>.
import { corsHeaders } from '../_shared/cors.ts';
import { createCallerClient } from '../_shared/supabaseAdmin.ts';
import { callPartner, partnerApiUrl } from '../_shared/spekoohPartner.ts';

const SPEKOOH_WEBHOOK_URL = Deno.env.get('SPEKOOH_WEBHOOK_URL');
const SPEKOOH_WEBHOOK_SECRET = Deno.env.get('SPEKOOH_WEBHOOK_SECRET');
const SPEKOOH_PARTNER_ID = Deno.env.get('SPEKOOH_PARTNER_ID') ?? 's-learn';

type SpekoohCategory = { key: string; title: string };

type RequestBody = { action: 'list_categories' } | { action: 'save'; qualified_categories: unknown };

function isRequestBody(value: unknown): value is RequestBody {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.action === 'list_categories') return true;
  if (v.action === 'save') return 'qualified_categories' in v;
  return false;
}

async function fetchLiveCategories(): Promise<{ ok: true; categories: SpekoohCategory[] } | { ok: false; response: Response }> {
  const url = partnerApiUrl(SPEKOOH_WEBHOOK_URL, 'categories');
  if (!url || !SPEKOOH_WEBHOOK_SECRET) {
    return { ok: false, response: json({ error: 'Spekooh integration is not configured on this deployment' }, 500) };
  }
  let result;
  try {
    result = await callPartner({ url, partnerId: SPEKOOH_PARTNER_ID, secret: SPEKOOH_WEBHOOK_SECRET, payload: {} });
  } catch (err) {
    return { ok: false, response: json({ error: `Could not reach Spekooh: ${err instanceof Error ? err.message : String(err)}` }, 502) };
  }
  if (result.status !== 200) {
    return { ok: false, response: json({ error: 'Spekooh could not provide its category list', detail: result.body }, 502) };
  }
  const categories = (result.body as { categories?: SpekoohCategory[] })?.categories;
  if (!Array.isArray(categories)) {
    return { ok: false, response: json({ error: 'Unexpected response from Spekooh' }, 502) };
  }
  return { ok: true, categories };
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
    return json({ error: "Expected { action: 'list_categories' } or { action: 'save', qualified_categories: string[] }" }, 400);
  }

  if (body.action === 'list_categories') {
    const result = await fetchLiveCategories();
    return result.ok ? json({ categories: result.categories }) : result.response;
  }

  // action === 'save'
  const requested = body.qualified_categories;
  if (!Array.isArray(requested) || !requested.every((c) => typeof c === 'string')) {
    return json({ error: 'qualified_categories must be a list of strings' }, 400);
  }

  const caller = createCallerClient(authHeader);
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'Invalid or expired session' }, 401);
  }

  // Re-validated here, not just trusted from the client's earlier
  // list_categories call — the same defense-in-depth reasoning as every
  // other write path in this integration (e.g. spekooh-respond's
  // storage_path ownership check).
  const liveCategories = await fetchLiveCategories();
  if (!liveCategories.ok) return liveCategories.response;
  const validKeys = new Set(liveCategories.categories.map((c) => c.key));
  const unknown = requested.filter((key) => !validKeys.has(key));
  if (unknown.length > 0) {
    return json({ error: `Unknown category key(s): ${unknown.join(', ')}` }, 400);
  }

  const { data: profile, error: profileError } = await caller
    .from('profiles')
    .select('email, full_name')
    .eq('id', userData.user.id)
    .single();
  if (profileError || !profile) {
    return json({ error: 'Could not load your profile' }, 500);
  }

  // Saved locally first: if the push to Spekooh then fails, the
  // instructor's own choice isn't lost, and a retry of 'save' re-sends it.
  const { error: saveError } = await caller
    .from('spekooh_instructor_qualifications')
    .upsert({ instructor_id: userData.user.id, qualified_categories: requested }, { onConflict: 'instructor_id' });
  if (saveError) {
    return json({ error: `Could not save your qualifications: ${saveError.message}` }, 500);
  }

  let pushResult;
  try {
    pushResult = await callPartner({
      url: SPEKOOH_WEBHOOK_URL as string, // present: fetchLiveCategories already required it
      partnerId: SPEKOOH_PARTNER_ID,
      secret: SPEKOOH_WEBHOOK_SECRET as string,
      payload: {
        event_type: 'instructor_profile_update',
        instructor_id: userData.user.id,
        email: profile.email,
        display_name: profile.full_name ?? '',
        qualified_categories: requested,
      },
    });
  } catch (err) {
    return json({
      ok: true,
      warning: `Saved here, but could not reach Spekooh: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  if (pushResult.status !== 200 || (pushResult.body as { applied?: boolean })?.applied === false) {
    return json({ ok: true, warning: 'Saved here, but Spekooh rejected the update', detail: pushResult.body });
  }
  return json({ ok: true });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
