-- Stripe payments for paid courses.
--
-- Real bug fixed by this migration + the create-checkout-session/stripe-webhook
-- edge functions: CourseDetail.tsx's handleEnroll inserted directly into
-- `enrollments` for any signed-in user regardless of `courses.price` — there
-- was no payment step at all, so a paid course could be "enrolled" in for
-- free. The enrollments INSERT policy below closes that at the DB layer too
-- (defense in depth, not just a frontend fix): a client can now only
-- self-enroll directly when the course is actually free. For paid courses,
-- the only path to an enrollments row is the stripe-webhook function, which
-- writes with the service role after Stripe confirms payment.
create table payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text,
  amount numeric not null,
  currency text not null default 'usd',
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed', 'refunded')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index payments_student_idx on payments(student_id);
create index payments_course_idx on payments(course_id);

alter table payments enable row level security;

grant usage on schema public to anon, authenticated, service_role;
grant select on payments to anon, authenticated, service_role;
grant insert, update on payments to service_role;

-- No client INSERT/UPDATE policy — same pattern as ai_tutor_requests
-- (0006_ai_tutor_rate_limiting.sql). Only create-checkout-session and
-- stripe-webhook, both using the service role, ever write to this table.
create policy "students view their own payments"
  on payments for select
  using (student_id = (select auth.uid()));

drop policy "students enroll themselves" on enrollments;
create policy "students enroll themselves"
  on enrollments for insert
  with check (
    student_id = (select auth.uid())
    and exists (select 1 from profiles p where p.id = (select auth.uid()) and p.role = 'student')
    and exists (select 1 from courses c where c.id = enrollments.course_id and c.price = 0)
  );
