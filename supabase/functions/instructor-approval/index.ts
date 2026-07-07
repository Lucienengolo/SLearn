// Reviewer-only action: approve or reject an instructor application.
// This is the ONLY path that flips profiles.role/verified to instructor —
// not the client, not even a reviewer's own session (RLS has no UPDATE
// policy for that). Call with:
//   POST { applicationId: string, decision: 'approved' | 'rejected', notes?: string }
//   Authorization: Bearer <reviewer's user JWT>
import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient, createCallerClient } from '../_shared/supabaseAdmin.ts';
import { emailTemplates, sendEmail } from '../_shared/email.ts';

type DecisionBody = {
  applicationId: string;
  decision: 'approved' | 'rejected';
  notes?: string;
};

function isDecisionBody(value: unknown): value is DecisionBody {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.applicationId === 'string' &&
    (v.decision === 'approved' || v.decision === 'rejected') &&
    (v.notes === undefined || typeof v.notes === 'string')
  );
}

const ELIGIBLE_STATUSES = ['submitted', 'review', 'interview'];

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

  if (!isDecisionBody(body)) {
    return json({ error: 'Expected { applicationId, decision, notes? }' }, 400);
  }

  const admin = createAdminClient();

  // Identify the caller from their own JWT, then check reviewer status
  // through the admin client (authoritative regardless of RLS).
  const caller = createCallerClient(authHeader);
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'Invalid or expired session' }, 401);
  }

  const { data: reviewerProfile, error: reviewerError } = await admin
    .from('profiles')
    .select('is_reviewer')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (reviewerError || !reviewerProfile?.is_reviewer) {
    return json({ error: 'Not authorized to review applications' }, 403);
  }

  const { data: application, error: applicationError } = await admin
    .from('instructor_applications')
    .select('id, applicant_id, status, full_name')
    .eq('id', body.applicationId)
    .maybeSingle();

  if (applicationError || !application) {
    return json({ error: 'Application not found' }, 404);
  }

  if (!ELIGIBLE_STATUSES.includes(application.status)) {
    return json({ error: `Application already decided (status: ${application.status})` }, 409);
  }

  const { data: applicantProfile } = await admin
    .from('profiles')
    .select('email, full_name')
    .eq('id', application.applicant_id)
    .single();

  const now = new Date().toISOString();

  const { error: updateError } = await admin
    .from('instructor_applications')
    .update({ status: body.decision, decided_at: now, decision_notes: body.notes ?? null })
    .eq('id', application.id);

  if (updateError) {
    return json({ error: `Failed to update application: ${updateError.message}` }, 500);
  }

  if (body.decision === 'approved') {
    const { error: profileError } = await admin
      .from('profiles')
      .update({ role: 'instructor', verified: true })
      .eq('id', application.applicant_id);

    if (profileError) {
      return json({ error: `Application approved but role update failed: ${profileError.message}` }, 500);
    }
  }

  const displayName = applicantProfile?.full_name || application.full_name || 'there';
  if (applicantProfile?.email) {
    try {
      if (body.decision === 'approved') {
        await sendEmail(applicantProfile.email, "You're verified — welcome to teaching!", emailTemplates.approved(displayName));
      } else {
        await sendEmail(
          applicantProfile.email,
          'An update on your instructor application',
          emailTemplates.rejected(displayName, body.notes)
        );
      }
    } catch (err) {
      // Decision already persisted — a failed email shouldn't roll it back.
      console.error('Failed to send decision email:', err);
    }
  }

  return json({ ok: true, applicationId: application.id, decision: body.decision });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
