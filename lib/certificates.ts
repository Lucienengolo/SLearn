import { supabase } from './supabase';
import { notifySelf } from './notifications';

// A course may have at most one quiz with course_id set (its "final exam" --
// see 0029_completion_quizzes.sql). Its presence is the only gating signal:
// no course quiz means the existing "100% of lessons done -> certificate"
// flow is unchanged.
export async function getCourseFinalExam(courseId: string) {
  const { data } = await supabase.from('quizzes').select('*').eq('course_id', courseId).maybeSingle();
  return data;
}

export async function hasPassedQuiz(userId: string, quizId: string): Promise<boolean> {
  const { data } = await supabase
    .from('quiz_attempts')
    .select('id')
    .eq('student_id', userId)
    .eq('quiz_id', quizId)
    .eq('passed', true)
    .limit(1)
    .maybeSingle();
  return !!data;
}

// Inserts the certificate row (idempotent -- unique (student_id, course_id)
// means a second call is a silent no-op) and fires the in-app notification
// plus a best-effort certificate email. Returns true if a certificate was
// newly issued this call.
export async function issueCertificateIfEligible(userId: string, course: { id: string; title: string }): Promise<boolean> {
  const { data: existingCert } = await supabase
    .from('certificates')
    .select('id')
    .eq('student_id', userId)
    .eq('course_id', course.id)
    .maybeSingle();

  if (existingCert) return false;

  const { error: insertError } = await supabase.from('certificates').insert({
    student_id: userId,
    course_id: course.id,
  });
  if (insertError) return false;

  await notifySelf(
    userId,
    'Certificate earned!',
    `You completed "${course.title}" — view your certificate.`,
    'certificates'
  );

  // Best-effort: a failed/misconfigured email (e.g. RESEND_API_KEY unset in
  // this environment) must never block certificate issuance, which has
  // already succeeded above.
  try {
    await supabase.functions.invoke('send-certificate-email', { body: { courseId: course.id } });
  } catch (err) {
    console.error('Failed to send certificate email:', err);
  }

  return true;
}
