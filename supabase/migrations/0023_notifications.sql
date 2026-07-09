-- In-app notification center. Distinct from the application_notifications
-- pgmq queue (0011_notification_queue.sql), which is a server-side email
-- delivery queue with no per-user read state -- this is a real, client-
-- readable table backing a bell icon in the header.
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on notifications(user_id, created_at desc);

alter table notifications enable row level security;

create policy "users view their own notifications"
  on notifications for select
  using (user_id = (select auth.uid()));

create policy "users mark their own notifications read"
  on notifications for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Inserts only ever come from server-side code (the client has no
-- legitimate reason to write someone a notification) -- the instructor-
-- approval edge function (service role) and the certificate-earned path
-- in LessonViewer, which runs as the student's own session and can only
-- insert a notification for themselves.
create policy "users create their own notifications"
  on notifications for insert
  with check (user_id = (select auth.uid()));
