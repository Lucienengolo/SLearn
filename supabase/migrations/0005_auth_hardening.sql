-- Auth hardening (README §6 DO-5).
--
-- 1. Move profile creation server-side via an auth.users trigger. Turning on
--    "require email confirmation" (a Supabase Auth dashboard/config.toml
--    setting, not something a migration controls) means auth.signUp()
--    returns with no active session until the user clicks the confirmation
--    link. The previous flow inserted the profile row from the client right
--    after signUp() — with no session yet, that insert runs as `anon` with
--    auth.uid() = null, which the "users create their own profile" policy
--    rejects. A trigger sidesteps this: it fires the moment the auth.users
--    row is created, regardless of confirmation status.
--
-- 2. Explicit Data API grants for every table from 0001-0004. Supabase used
--    to auto-grant anon/authenticated/service_role on new public-schema
--    tables; that behavior is being phased out (opt-out already available
--    per-project, becomes the default for any table created after
--    2026-10-30 regardless of project age). Without an explicit grant, a
--    table with correct RLS policies can still be completely unreachable
--    via the Data API. RLS remains the actual access control — these grants
--    only restore "reachable via the API at all", matching the platform's
--    old default.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, verified)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    'student',
    false
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on
  profiles, categories, courses, lessons, enrollments, lesson_progress,
  quizzes, quiz_questions, quiz_attempts, certificates, reviews,
  instructor_applications, instructor_credentials, interview_slots, interviews
to anon, authenticated, service_role;
