-- Founder request, 2026-08-04: instructor applicants now upload a sample
-- question paper (proof they can write meaningful quizzes for students,
-- not just teach), alongside the existing CV/sample-lesson/degree/
-- certificate/selfie credential types. New enum value only -- no RLS
-- change needed, the existing "applicants upload credentials before a
-- final decision" / "applicants and reviewers view credentials" policies
-- on instructor_credentials already cover any credential_type value.
alter type instructor_credential_type add value 'question_paper';
