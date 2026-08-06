-- Admin capabilities batch, founder request 2026-08-06 (follow-up to
-- 0054_admin_role.sql/0055_public_profiles_is_admin.sql): notify/warn an
-- instructor, private admin notes, unpublish a single course, platform
-- broadcasts, resolve a stuck tutor-match dispute, full match oversight,
-- and an admin action audit log. Confirmed via direct repo search before
-- building: nothing anywhere ever transitions a match OUT of
-- 'dispute_review' today -- resolve_dispute() below is a real gap-fill,
-- not just a nice-to-have.

-- Audit log -------------------------------------------------------------
create table admin_action_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references profiles(id),
  action text not null,
  target_type text,
  target_id uuid,
  detail text,
  created_at timestamptz not null default now()
);

create index admin_action_log_created_idx on admin_action_log(created_at desc);

alter table admin_action_log enable row level security;

create policy "admins view the action log"
  on admin_action_log for select
  using (exists (select 1 from profiles p where p.id = (select auth.uid()) and p.is_admin = true));

-- Shared by every admin-mutating RPC below (and retrofitted into the
-- three existing ones from 0054) -- this is about admin accountability to
-- each other, not principal-only secrecy, so any admin can read the full
-- trail (the SELECT policy above), not just write to it.
create or replace function log_admin_action(p_action text, p_target_type text, p_target_id uuid, p_detail text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into admin_action_log (admin_id, action, target_type, target_id, detail)
  values (auth.uid(), p_action, p_target_type, p_target_id, p_detail);
end;
$$;

-- Retrofit the three existing admin RPCs (0054_admin_role.sql) to log too
-- -- otherwise the very first admin actions this app can ever take have a
-- gap in an audit trail that's supposed to be complete.
create or replace function deactivate_instructor(p_instructor_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true) then
    raise exception 'Only an admin can deactivate an instructor';
  end if;

  update profiles
  set verified = false
  where id = p_instructor_id and role = 'instructor' and verified = true;

  if not found then
    raise exception 'No active instructor found for that id';
  end if;

  perform log_admin_action('deactivate_instructor', 'profile', p_instructor_id, null);

  insert into notifications (user_id, title, body, link)
  values (p_instructor_id, 'Instructor status changed', 'Your instructor access has been deactivated by an administrator.', 'dashboard');
end;
$$;

create or replace function reactivate_instructor(p_instructor_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true) then
    raise exception 'Only an admin can reactivate an instructor';
  end if;

  update profiles
  set verified = true
  where id = p_instructor_id and role = 'instructor' and verified = false;

  if not found then
    raise exception 'No deactivated instructor found for that id';
  end if;

  perform log_admin_action('reactivate_instructor', 'profile', p_instructor_id, null);

  insert into notifications (user_id, title, body, link)
  values (p_instructor_id, 'Instructor status changed', 'Your instructor access has been reactivated by an administrator.', 'dashboard');
end;
$$;

create or replace function set_admin_access(p_target_email text, p_is_admin boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_target_id uuid;
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.email = 'storefix237@gmail.com') then
    raise exception 'Only the principal admin can manage admin access';
  end if;

  if p_target_email = 'storefix237@gmail.com' and p_is_admin = false then
    raise exception 'The principal admin cannot be demoted';
  end if;

  select id into v_target_id from profiles where email = p_target_email;
  if v_target_id is null then
    raise exception 'No account found for %', p_target_email;
  end if;

  update profiles set is_admin = p_is_admin where id = v_target_id;

  perform log_admin_action('set_admin_access', 'profile', v_target_id, format('is_admin=%s', p_is_admin));
end;
$$;

-- #1 -- Notify/warn an instructor -----------------------------------------
create or replace function notify_instructor(p_instructor_id uuid, p_title text, p_body text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true) then
    raise exception 'Only an admin can notify an instructor';
  end if;

  if not exists (select 1 from profiles p where p.id = p_instructor_id and p.role = 'instructor') then
    raise exception 'No instructor found for that id';
  end if;

  insert into notifications (user_id, title, body, link)
  values (p_instructor_id, p_title, p_body, 'dashboard');

  perform log_admin_action('notify_instructor', 'profile', p_instructor_id, p_title);
end;
$$;

grant execute on function notify_instructor(uuid, text, text) to authenticated;

-- #2 -- Private admin notes on an instructor -------------------------------
-- Simple enough to gate with a direct RLS policy rather than an RPC
-- round-trip, same pattern as 0004's is_reviewer-scoped policies.
create table instructor_admin_notes (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references profiles(id) on delete cascade,
  admin_id uuid not null references profiles(id),
  note text not null,
  created_at timestamptz not null default now()
);

create index instructor_admin_notes_instructor_idx on instructor_admin_notes(instructor_id, created_at desc);

alter table instructor_admin_notes enable row level security;

create policy "admins view instructor notes"
  on instructor_admin_notes for select
  using (exists (select 1 from profiles p where p.id = (select auth.uid()) and p.is_admin = true));

create policy "admins add instructor notes"
  on instructor_admin_notes for insert
  with check (
    admin_id = (select auth.uid())
    and exists (select 1 from profiles p where p.id = (select auth.uid()) and p.is_admin = true)
  );

-- #3 -- Unpublish a single course ------------------------------------------
-- courses_guard_moderation (0026_fix_reviewer_course_update_policy.sql)
-- reverts is_published for any non-owning reviewer touching someone
-- else's course -- the founder's own account is both is_reviewer and
-- is_admin, so without this extension their own admin unpublish action
-- would be silently reverted by the existing reviewer-lockdown branch.
-- The fix: an admin caller may still flip is_published through that
-- branch, but only in a statement that doesn't ALSO change
-- moderation_status -- a genuine moderation decision (which never
-- touches is_published today, per decideCourse()) stays exactly as
-- locked down as before.
create or replace function courses_guard_moderation()
returns trigger language plpgsql as $$
declare
  caller_is_reviewer boolean;
  caller_is_admin boolean;
  caller_is_owner boolean;
begin
  caller_is_reviewer := auth.role() = 'service_role'
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_reviewer = true);
  caller_is_admin := auth.role() = 'service_role'
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true);
  caller_is_owner := old.instructor_id = auth.uid();

  if caller_is_reviewer and not caller_is_owner and auth.role() <> 'service_role' then
    new.title := old.title;
    new.description := old.description;
    new.instructor_id := old.instructor_id;
    new.category_id := old.category_id;
    new.thumbnail_url := old.thumbnail_url;
    new.level := old.level;
    new.duration_hours := old.duration_hours;
    new.price := old.price;
    if not (caller_is_admin and new.moderation_status is not distinct from old.moderation_status) then
      new.is_published := old.is_published;
    end if;
  elsif not caller_is_reviewer then
    if new.moderation_status is distinct from old.moderation_status then
      new.moderation_status := old.moderation_status;
    end if;
    if new.is_published = true and old.is_published = false then
      new.moderation_status := 'pending';
      new.moderation_notes := null;
    end if;
  end if;

  return new;
end;
$$;

create or replace function admin_set_course_published(p_course_id uuid, p_is_published boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_instructor_id uuid;
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true) then
    raise exception 'Only an admin can change a course''s published status';
  end if;

  update courses set is_published = p_is_published where id = p_course_id
  returning instructor_id into v_instructor_id;

  if v_instructor_id is null then
    raise exception 'No course found for that id';
  end if;

  perform log_admin_action('admin_set_course_published', 'course', p_course_id, format('is_published=%s', p_is_published));

  if not p_is_published then
    insert into notifications (user_id, title, body, link)
    values (v_instructor_id, 'Course unpublished', 'One of your courses was unpublished by an administrator.', 'dashboard');
  end if;
end;
$$;

grant execute on function admin_set_course_published(uuid, boolean) to authenticated;

-- Read side for the admin Courses section -- fetchPendingCourses/
-- fetchDecidedCourses (lib/courseModeration.ts) rely on the "reviewers
-- view all courses" RLS policy (is_reviewer), a different permission
-- from is_admin; an admin who isn't also a reviewer couldn't use them.
-- Scoped to currently-published courses, since "manage/unpublish" only
-- cares about what's actually live.
create or replace function get_all_courses_admin()
returns table(
  id uuid,
  title text,
  instructor_name text,
  is_published boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true) then
    return;
  end if;

  return query
    select c.id, c.title, p.full_name, c.is_published, c.created_at
    from courses c
    join profiles p on p.id = c.instructor_id
    where c.is_published = true
    order by c.created_at desc;
end;
$$;

grant execute on function get_all_courses_admin() to authenticated;

-- #4 -- Platform-wide broadcast ---------------------------------------------
-- One notifications row per matching profile, same fan-out already used
-- for reviewer alerts (handleZeroMatch, mark_stalled_bookings). Known,
-- accepted scope limit at current user counts -- not batched/paginated.
create or replace function broadcast_announcement(p_audience text, p_title text, p_body text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true) then
    raise exception 'Only an admin can send a broadcast';
  end if;

  if p_audience not in ('all', 'students', 'instructors') then
    raise exception 'Invalid audience: %', p_audience;
  end if;

  insert into notifications (user_id, title, body, link)
  select p.id, p_title, p_body, null
  from profiles p
  where p_audience = 'all'
    or (p_audience = 'students' and p.role = 'student')
    or (p_audience = 'instructors' and p.role = 'instructor');

  perform log_admin_action('broadcast_announcement', null, null, format('audience=%s title=%s', p_audience, p_title));
end;
$$;

grant execute on function broadcast_announcement(text, text, text) to authenticated;

-- #5/#6 -- Dispute resolution + full match oversight -------------------------
create or replace function resolve_dispute(p_match_id uuid, p_resolution text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tutor_id uuid;
  v_parent_id uuid;
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true) then
    raise exception 'Only an admin can resolve a dispute';
  end if;

  if p_resolution not in ('cancelled_refunded', 'completed') then
    raise exception 'Invalid resolution: %', p_resolution;
  end if;

  update matches
  set status = p_resolution,
      cancelled_at = case when p_resolution = 'cancelled_refunded' then now() else cancelled_at end,
      completed_at = case when p_resolution = 'completed' then now() else completed_at end
  where id = p_match_id and status = 'dispute_review'
  returning tutor_id into v_tutor_id;

  if v_tutor_id is null then
    raise exception 'No dispute-review match found for that id';
  end if;

  update tutor_session_payments
  set cancellation_status = case when p_resolution = 'cancelled_refunded' then 'cancelled_refunded' else 'none' end,
      refund_status = case when p_resolution = 'cancelled_refunded' then refund_status else null end
  where match_id = p_match_id;

  select r.parent_id into v_parent_id
  from matches m join tutor_requests r on r.id = m.request_id
  where m.id = p_match_id;

  perform log_admin_action('resolve_dispute', 'match', p_match_id, p_resolution);

  insert into notifications (user_id, title, body, link)
  values
    (v_tutor_id, 'Dispute resolved', 'An administrator has resolved the dispute on your booking.', 'tutor-matches'),
    (v_parent_id, 'Dispute resolved', 'An administrator has resolved the dispute on your booking.', 'tutor-matches');
end;
$$;

grant execute on function resolve_dispute(uuid, text) to authenticated;

create or replace function get_all_matches_admin()
returns table(
  match_id uuid,
  status text,
  confirmed_session_date timestamptz,
  parent_name text,
  tutor_name text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true) then
    return;
  end if;

  return query
    select m.id, m.status, m.confirmed_session_date, pp.full_name, tp.full_name, m.created_at
    from matches m
    join tutor_requests r on r.id = m.request_id
    join profiles pp on pp.id = r.parent_id
    join profiles tp on tp.id = m.tutor_id
    order by m.created_at desc;
end;
$$;

grant execute on function get_all_matches_admin() to authenticated;

-- Read side of the audit log -- admin-only, most recent first.
create or replace function get_admin_action_log()
returns table(
  id uuid,
  admin_name text,
  action text,
  target_type text,
  target_id uuid,
  detail text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true) then
    return;
  end if;

  return query
    select l.id, p.full_name, l.action, l.target_type, l.target_id, l.detail, l.created_at
    from admin_action_log l
    join profiles p on p.id = l.admin_id
    order by l.created_at desc
    limit 200;
end;
$$;

grant execute on function get_admin_action_log() to authenticated;
