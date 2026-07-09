// Sends a "certificate earned" email to the calling student. Certificate
// issuance itself is client-driven (see lib/certificates.ts) -- this
// function only sends the email, and only for a certificate that already
// exists, so it can't be used to spam arbitrary students. Call with:
//   POST { courseId: string }
//   Authorization: Bearer <student's user JWT>
import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient, createCallerClient } from '../_shared/supabaseAdmin.ts';
import { emailTemplates, sendEmail } from '../_shared/email.ts';

type Body = { courseId: string };

function isBody(value: unknown): value is Body {
  if (typeof value !== 'object' || value === null) return false;
  return typeof (value as Record<string, unknown>).courseId === 'string';
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

  if (!isBody(body)) {
    return json({ error: 'Expected { courseId }' }, 400);
  }

  const admin = createAdminClient();
  const caller = createCallerClient(authHeader);
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'Invalid or expired session' }, 401);
  }

  const { data: certificate } = await admin
    .from('certificates')
    .select('id')
    .eq('student_id', userData.user.id)
    .eq('course_id', body.courseId)
    .maybeSingle();

  if (!certificate) {
    return json({ error: 'No certificate found for this student/course' }, 404);
  }

  const [{ data: profile }, { data: course }] = await Promise.all([
    admin.from('profiles').select('email, full_name').eq('id', userData.user.id).single(),
    admin.from('courses').select('title').eq('id', body.courseId).single(),
  ]);

  if (profile?.email && course?.title) {
    try {
      await sendEmail(
        profile.email,
        'Certificate earned!',
        emailTemplates.certificateEarned(profile.full_name || 'there', course.title)
      );
    } catch (err) {
      console.error('Failed to send certificate email:', err);
    }
  }

  return json({ ok: true });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
