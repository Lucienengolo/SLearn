// Matching engine for the tutor marketplace (CEO plan Row 1, Eng Review
// E2/E6). Scores verified tutors teaching the requested subject by
// neighborhood + language + self-reported response time (scoring.ts, unit
// tested separately), then attempts to assign the best candidate.
//
// The actual concurrency guard is the partial unique index
// matches_one_active_per_tutor_idx (0030_tutor_marketplace.sql) -- this
// function's job is to catch a 23505 unique-violation on insert (meaning
// another request grabbed this tutor first) and retry the next-best
// candidate, rather than to prevent the race itself. That's what makes this
// safe under two concurrent requests scoring the same single available
// tutor (Post-Spec-Review item 22).
//
// Call with: POST { requestId: string }, Authorization: Bearer <parent's JWT>
import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient, createCallerClient } from '../_shared/supabaseAdmin.ts';
import { rankCandidates, type TutorCandidate } from './scoring.ts';
import { assignBestAvailableCandidate } from './assignment.ts';

type RequestBody = { requestId: string };

function isRequestBody(value: unknown): value is RequestBody {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.requestId === 'string';
}

const ACTIVE_MATCH_STATUSES = ['matched', 'messaging', 'deposit_paid', 'in_progress'];
const TUTOR_RESPONSE_WINDOW_MS = 48 * 60 * 60 * 1000;
const UNIQUE_VIOLATION = '23505';

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
    return json({ error: 'Expected { requestId }' }, 400);
  }

  const admin = createAdminClient();
  const caller = createCallerClient(authHeader);

  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'Invalid or expired session' }, 401);
  }

  // Fetched with the caller's own JWT: the "parents view their own requests"
  // RLS policy is what actually enforces ownership here, not an app-level
  // check -- a parent cannot trigger matching for someone else's request.
  const { data: tutorRequest, error: requestError } = await caller
    .from('tutor_requests')
    .select('id, category_id, neighborhood, preferred_language, status')
    .eq('id', body.requestId)
    .maybeSingle();

  if (requestError || !tutorRequest) {
    return json({ error: 'Request not found' }, 404);
  }

  if (tutorRequest.status !== 'searching') {
    return json({ error: `Request already ${tutorRequest.status}` }, 409);
  }

  const { data: subjectRows, error: subjectError } = await admin
    .from('tutor_subjects')
    .select('tutor_id, neighborhood')
    .eq('category_id', tutorRequest.category_id);

  if (subjectError) {
    return json({ error: `Failed to look up candidate tutors: ${subjectError.message}` }, 500);
  }

  const candidateTutorIds = (subjectRows ?? []).map((r) => r.tutor_id);
  if (candidateTutorIds.length === 0) {
    return await handleZeroMatch(admin, tutorRequest);
  }

  const { data: busyRows, error: busyError } = await admin
    .from('matches')
    .select('tutor_id')
    .in('tutor_id', candidateTutorIds)
    .in('status', ACTIVE_MATCH_STATUSES);

  if (busyError) {
    return json({ error: `Failed to check tutor availability: ${busyError.message}` }, 500);
  }
  const busyTutorIds = new Set((busyRows ?? []).map((r) => r.tutor_id));

  const availableSubjectRows = (subjectRows ?? []).filter((r) => !busyTutorIds.has(r.tutor_id));
  if (availableSubjectRows.length === 0) {
    return await handleZeroMatch(admin, tutorRequest);
  }

  const { data: profileRows, error: profileError } = await admin
    .from('tutor_profile_fields')
    .select('tutor_id, languages, response_time_minutes')
    .in(
      'tutor_id',
      availableSubjectRows.map((r) => r.tutor_id)
    );

  if (profileError) {
    return json({ error: `Failed to load tutor profile fields: ${profileError.message}` }, 500);
  }

  const profileByTutorId = new Map((profileRows ?? []).map((p) => [p.tutor_id, p]));

  const candidates: TutorCandidate[] = availableSubjectRows
    .map((r) => {
      const profile = profileByTutorId.get(r.tutor_id);
      if (!profile) return null;
      return {
        tutorId: r.tutor_id,
        neighborhood: r.neighborhood,
        languages: profile.languages ?? [],
        responseTimeMinutes: profile.response_time_minutes ?? null,
      };
    })
    .filter((c): c is TutorCandidate => c !== null);

  if (candidates.length === 0) {
    return await handleZeroMatch(admin, tutorRequest);
  }

  const ranked = rankCandidates(candidates, {
    neighborhood: tutorRequest.neighborhood,
    preferredLanguage: tutorRequest.preferred_language,
  });

  const outcome = await assignBestAvailableCandidate<
    TutorCandidate,
    { id: string; tutor_id: string; status: string }
  >(ranked, async (candidate) => {
    const tutorTimeoutAt = new Date(Date.now() + TUTOR_RESPONSE_WINDOW_MS).toISOString();

    const { data: match, error: matchError } = await admin
      .from('matches')
      .insert({
        request_id: tutorRequest.id,
        tutor_id: candidate.tutorId,
        status: 'matched',
        tutor_timeout_at: tutorTimeoutAt,
      })
      .select('id, tutor_id, status')
      .single();

    if (!matchError && match) {
      return { outcome: 'assigned', candidate, result: match };
    }

    // Another concurrent request just grabbed this tutor -- the exact race
    // Post-Spec-Review item 22 flagged. Try the next-best candidate instead
    // of failing the whole request.
    if (matchError?.code === UNIQUE_VIOLATION) {
      return { outcome: 'conflict' };
    }

    return { outcome: 'error', message: matchError?.message ?? 'unknown error' };
  });

  if (outcome.assigned) {
    const { error: updateError } = await admin
      .from('tutor_requests')
      .update({ status: 'matched' })
      .eq('id', tutorRequest.id);

    if (updateError) {
      return json({ error: `Matched but failed to update request status: ${updateError.message}` }, 500);
    }

    return json({ matched: true, matchId: outcome.result.id, tutorId: outcome.result.tutor_id });
  }

  if (outcome.reason === 'error') {
    return json({ error: `Failed to create match: ${outcome.message}` }, 500);
  }

  return await handleZeroMatch(admin, tutorRequest);
});

async function handleZeroMatch(
  admin: ReturnType<typeof createAdminClient>,
  tutorRequest: { id: string }
): Promise<Response> {
  // Request stays 'searching' -- this is the "still looking" first-class
  // screen (Eng Review E7), not an error state, and re-running this
  // function later (e.g. once a new tutor verifies, or via a future
  // re-match cron) can still succeed against the same row.
  const { data: reviewers, error: reviewerError } = await admin
    .from('profiles')
    .select('id')
    .eq('is_reviewer', true);

  if (reviewerError) {
    console.error('Failed to look up reviewers for zero-match staff alert:', reviewerError.message);
  } else if (reviewers && reviewers.length > 0) {
    const { error: notifyError } = await admin.from('notifications').insert(
      reviewers.map((r) => ({
        user_id: r.id,
        title: 'Unmatched tutor request',
        body: `Request ${tutorRequest.id} has no available tutor. A parent is waiting.`,
        link: `admin/tutor-requests/${tutorRequest.id}`,
      }))
    );
    if (notifyError) {
      console.error('Failed to create zero-match staff alert:', notifyError.message);
    }
  }

  return json({ matched: false });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
