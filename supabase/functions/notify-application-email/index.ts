// Invoked by Postgres triggers (pg_net, see 0004_reviewer_and_notifications.sql)
// when an application is submitted or an interview is scheduled. Approved/
// rejected emails are sent directly by instructor-approval instead, so a
// decision doesn't fire two emails for the same event.
import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { emailTemplates, sendEmail } from '../_shared/email.ts';

type NotifyBody =
  | { event: 'application_submitted'; application_id: string }
  | { event: 'interview_scheduled'; interview_id: string };

function isNotifyBody(value: unknown): value is NotifyBody {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.event === 'application_submitted') return typeof v.application_id === 'string';
  if (v.event === 'interview_scheduled') return typeof v.interview_id === 'string';
  return false;
}

const WEBHOOK_SECRET = Deno.env.get('NOTIFY_WEBHOOK_SECRET');

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  // Shared secret set by both the DB trigger (app.settings.notify_webhook_secret)
  // and this function's NOTIFY_WEBHOOK_SECRET env var — proves the request
  // came from our own database, not the public internet.
  if (!WEBHOOK_SECRET || req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!isNotifyBody(body)) {
    return json({ error: 'Unrecognized event payload' }, 400);
  }

  const admin = createAdminClient();

  if (body.event === 'application_submitted') {
    const { data: application } = await admin
      .from('instructor_applications')
      .select('applicant_id, full_name')
      .eq('id', body.application_id)
      .maybeSingle();

    if (!application) return json({ ok: true, skipped: 'application not found' });

    const { data: profile } = await admin
      .from('profiles')
      .select('email, full_name')
      .eq('id', application.applicant_id)
      .maybeSingle();

    if (profile?.email) {
      const name = profile.full_name || application.full_name || 'there';
      await sendEmail(profile.email, "We've got your application", emailTemplates.applicationSubmitted(name));
    }

    return json({ ok: true });
  }

  // interview_scheduled
  const { data: interview } = await admin
    .from('interviews')
    .select('scheduled_at, application_id')
    .eq('id', body.interview_id)
    .maybeSingle();

  if (!interview) return json({ ok: true, skipped: 'interview not found' });

  const { data: application } = await admin
    .from('instructor_applications')
    .select('applicant_id, full_name')
    .eq('id', interview.application_id)
    .maybeSingle();

  if (!application) return json({ ok: true, skipped: 'application not found' });

  const { data: profile } = await admin
    .from('profiles')
    .select('email, full_name')
    .eq('id', application.applicant_id)
    .maybeSingle();

  if (profile?.email && interview.scheduled_at) {
    const name = profile.full_name || application.full_name || 'there';
    await sendEmail(
      profile.email,
      'Your interview is scheduled',
      emailTemplates.interviewScheduled(name, interview.scheduled_at)
    );
  }

  return json({ ok: true });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
