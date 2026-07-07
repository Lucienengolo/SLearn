-- Kairos Mind (in-lesson AI tutor) rate limiting (README §5.C, §6 DO-4).
-- The kairos-mind-tutor edge function is the only writer (via the service
-- role) — there is deliberately no INSERT policy for clients, so a request
-- count can't be forged by writing rows directly.
create table ai_tutor_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  lesson_id uuid references lessons(id) on delete set null,
  mode text not null check (mode in ('explain', 'quiz', 'translate')),
  created_at timestamptz not null default now()
);

create index ai_tutor_requests_user_created_idx on ai_tutor_requests(user_id, created_at);

alter table ai_tutor_requests enable row level security;

grant usage on schema public to anon, authenticated, service_role;
grant select, insert on ai_tutor_requests to anon, authenticated, service_role;

create policy "users view their own tutor usage"
  on ai_tutor_requests for select
  using (user_id = auth.uid());
