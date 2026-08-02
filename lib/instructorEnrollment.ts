import { supabase } from './supabase';

// "Add Student" (Slearn classroom.png reference, 2026-07-24) -- an
// instructor manually enrolling a student into their own course. Real use
// case: payment settled outside Stripe (bank transfer, mobile money
// on-site). Backed by a real RLS policy (0037_instructor_manual_enrollment.sql),
// not a client-side-only convenience -- the server enforces the instructor
// owns the course and the target profile is actually a student.
//
// The lookup itself is a security-definer RPC (find_student_id_by_email,
// 0046_restrict_profile_email.sql), not a direct profiles.email query --
// profiles.email isn't a selectable/filterable column for a plain client
// query anymore (2026-08-02 security fix), and the RPC is a real
// tightening besides: it requires the caller to be a VERIFIED instructor,
// where the previous direct lookup had no relationship check at all (any
// authenticated caller could probe "does this email exist").
export async function enrollStudentByEmail(courseId: string, email: string): Promise<void> {
  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail) {
    throw new Error('Enter a student email address.');
  }

  const { data: matches, error: lookupError } = await supabase.rpc('find_student_id_by_email', {
    p_email: trimmedEmail,
  });

  if (lookupError) throw lookupError;
  const student = (matches ?? [])[0] as { id: string; role: string } | undefined;
  if (!student) {
    throw new Error('No account found with that email address.');
  }
  if (student.role !== 'student') {
    throw new Error('That account is not a student account.');
  }

  const { data: existing } = await supabase
    .from('enrollments')
    .select('id')
    .eq('course_id', courseId)
    .eq('student_id', student.id)
    .maybeSingle();

  if (existing) {
    throw new Error('This student is already enrolled in this course.');
  }

  const { error: insertError } = await supabase.from('enrollments').insert({
    course_id: courseId,
    student_id: student.id,
  });

  if (insertError) throw insertError;
}
