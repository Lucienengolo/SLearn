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
    .select(
      `id, applicant_id, status, full_name, offers_tutoring, tutoring_category_ids, tutoring_neighborhood,
       tutoring_teaching_mode, tutoring_languages, tutoring_rate_per_session, tutoring_response_time_minutes, tutoring_whatsapp`
    )
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

    // Founder feedback (2026-07-22): don't make a newly-approved instructor
    // fill out a second form to start tutoring -- if they opted in during
    // the application (0034_tutoring_opt_in_application_fields.sql),
    // populate tutor_profile_fields/tutor_subjects directly from what they
    // already submitted. TutorProfileForm.tsx remains available afterward
    // purely as an edit tool, or for an instructor who skipped this and
    // wants to opt in later.
    if (application.offers_tutoring) {
      const { error: tutorFieldsError } = await admin.from('tutor_profile_fields').upsert(
        {
          tutor_id: application.applicant_id,
          teaching_mode: application.tutoring_teaching_mode ?? 'both',
          neighborhood: application.tutoring_neighborhood ?? '',
          languages: application.tutoring_languages ?? [],
          rate_per_session: application.tutoring_rate_per_session ?? 0,
          response_time_minutes: application.tutoring_response_time_minutes ?? null,
          whatsapp_contact: application.tutoring_whatsapp ?? '',
        },
        { onConflict: 'tutor_id' }
      );
      if (tutorFieldsError) {
        console.error('Failed to auto-populate tutor_profile_fields on approval:', tutorFieldsError.message);
      }

      if (!tutorFieldsError && application.tutoring_category_ids?.length > 0) {
        const { error: subjectsError } = await admin.from('tutor_subjects').insert(
          application.tutoring_category_ids.map((categoryId: string) => ({
            tutor_id: application.applicant_id,
            category_id: categoryId,
            neighborhood: application.tutoring_neighborhood ?? '',
          }))
        );
        if (subjectsError) {
          console.error('Failed to auto-populate tutor_subjects on approval:', subjectsError.message);
        }
      }
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

  // In-app notification (separate from the email above) -- uses the
  // admin client since this is a cross-user write (the reviewer's
  // session notifying the applicant), which the RLS insert policy on
  // notifications deliberately doesn't allow from a client session.
  const { error: notifyError } = await admin.from('notifications').insert({
    user_id: application.applicant_id,
    title: body.decision === 'approved' ? "You're verified — welcome to teaching!" : 'Instructor application update',
    body:
      body.decision === 'approved'
        ? 'Your instructor application was approved. Your studio is ready.'
        : body.notes || 'Your instructor application was not approved this time.',
    link: 'dashboard',
  });
  if (notifyError) {
    console.error('Failed to create in-app notification:', notifyError);
  }

  return json({ ok: true, applicationId: application.id, decision: body.decision });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
