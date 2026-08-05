-- Founder request, 2026-08-05: real role-based admin access, prompted
-- directly by the "app shows 3 instructors but I only registered 1"
-- report (root cause: 2 leftover E2E test-fixture profiles, already
-- deleted from production with the founder's confirmation) -- there was
-- no way to see/manage all registered instructors, and no admin concept
-- at all beyond profiles.is_reviewer (application/course moderation only).
--
-- storefix237@gmail.com (the founder's own account, already
-- is_reviewer=true in production) is the principal admin -- confirmed via
-- AskUserQuestion: only the principal manages admin access (not any
-- admin), and deactivating an instructor is reversible (verified toggle),
-- not a delete.
alter table profiles add column if not exists is_admin boolean not null default false;

update profiles set is_admin = true where email = 'storefix237@gmail.com';

-- Extends the existing role/verified/is_reviewer escalation guard
-- (0004_reviewer_and_notifications.sql) with a separate, narrowly-scoped
-- is_admin check, only evaluated when is_admin actually changes -- a
-- normal profile edit (avatar/bio/full_name) never pays this extra
-- lookup. Two rules: the principal's own row can never have is_admin set
-- to false (self-lockout protection, no exception even for service_role);
-- otherwise a client-side is_admin change is only allowed when the
-- caller is the principal admin. This is defense-in-depth -- the real
-- authorization lives in set_admin_access() below, which doesn't even
-- need this (it's security definer, bypasses RLS) -- this just closes
-- off any other write path, same reasoning as
-- matches_guard_tutor_dismissal (0053_tutor_dismisses_own_matches.sql).
create or replace function profiles_set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.role <> old.role or new.verified <> old.verified or new.is_reviewer <> old.is_reviewer then
    if auth.role() <> 'service_role' then
      -- Admins may change verified alone (deactivate_instructor /
      -- reactivate_instructor, both below) -- but never role or
      -- is_reviewer through this path, and not verified in the same
      -- statement as a role/is_reviewer change. Caught live: without this
      -- exception, deactivate_instructor's own UPDATE silently no-ops --
      -- it runs as the calling admin (not service_role), so this guard
      -- was reverting `verified` right back before the row ever persists.
      if new.role = old.role and new.is_reviewer = old.is_reviewer and exists (
        select 1 from profiles p where p.id = (select auth.uid()) and p.is_admin = true
      ) then
        null;
      else
        new.role = old.role;
        new.verified = old.verified;
        new.is_reviewer = old.is_reviewer;
      end if;
    end if;
  end if;

  if new.is_admin <> old.is_admin then
    if new.email = 'storefix237@gmail.com' and new.is_admin = false then
      new.is_admin = true;
    elsif auth.role() <> 'service_role' and not exists (
      select 1 from profiles p where p.id = (select auth.uid()) and p.email = 'storefix237@gmail.com'
    ) then
      new.is_admin = old.is_admin;
    end if;
  end if;

  new.updated_at = now();
  return new;
end;
$$;

-- Principal-admin-only: grant or revoke admin access for another account.
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
end;
$$;

grant execute on function set_admin_access(text, boolean) to authenticated;

-- Admin-only: every live instructor account, not just pending
-- applications (fetchReviewQueue/fetchDecidedApplications in
-- lib/instructorApplications.ts only ever cover the pre-approval
-- pipeline -- nothing lists already-approved instructors today).
create or replace function get_all_instructors()
returns table(
  id uuid,
  email text,
  full_name text,
  verified boolean,
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
    select p.id, p.email, p.full_name, p.verified, p.created_at
    from profiles p
    where p.role = 'instructor'
    order by p.created_at desc;
end;
$$;

grant execute on function get_all_instructors() to authenticated;

-- Admin-only, reversible: deactivate/reactivate an instructor. Only
-- ever toggles `verified`, never `role` -- confirmed via
-- supabase/functions/instructor-approval/index.ts:111 that role and
-- verified are only ever set together, at approval time, so
-- role='instructor', verified=false is otherwise an unused combination.
-- Touching role too would make a deactivated instructor indistinguishable
-- from a pending applicant.
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

  insert into notifications (user_id, title, body, link)
  values (p_instructor_id, 'Instructor status changed', 'Your instructor access has been deactivated by an administrator.', 'dashboard');
end;
$$;

grant execute on function deactivate_instructor(uuid) to authenticated;

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

  insert into notifications (user_id, title, body, link)
  values (p_instructor_id, 'Instructor status changed', 'Your instructor access has been reactivated by an administrator.', 'dashboard');
end;
$$;

grant execute on function reactivate_instructor(uuid) to authenticated;
