-- 0025 added a reviewer SELECT policy on courses ("reviewers view all
-- courses") but no corresponding UPDATE policy -- the only existing
-- UPDATE policy is "instructors manage their own courses"
-- (using instructor_id = auth.uid()), which a reviewer approving someone
-- ELSE's course never satisfies. Found by actually clicking Approve as
-- the real admin account and checking the row didn't change: the
-- request returned 0 rows matched, not an error, since a
-- USING-clause mismatch on UPDATE just silently excludes the row rather
-- than raising anything.
create policy "reviewers update any course"
  on courses for update
  using (exists (select 1 from profiles p where p.id = (select auth.uid()) and p.is_reviewer = true));

-- Granting that row-level UPDATE access means a reviewer's request could,
-- in principle, carry changes to any column (title, price, etc), not
-- just the moderation fields -- RLS operates per-row, not per-column.
-- The app's own decideCourse() only ever sends moderation_status/
-- moderation_notes, but the trigger should enforce that regardless of
-- what a request actually contains: for a non-owning reviewer (not the
-- instructor, not service_role), revert every column except the
-- moderation fields (and updated_at) back to its pre-update value.
create or replace function courses_guard_moderation()
returns trigger language plpgsql as $$
declare
  caller_is_reviewer boolean;
  caller_is_owner boolean;
begin
  caller_is_reviewer := auth.role() = 'service_role'
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_reviewer = true);
  -- old.instructor_id, not new: checking the pre-update owner, immune to
  -- being spoofed by whatever instructor_id value the update payload
  -- itself carries.
  caller_is_owner := old.instructor_id = auth.uid();

  if caller_is_reviewer and not caller_is_owner and auth.role() <> 'service_role' then
    -- Reviewer acting on someone else's course: only moderation_status/
    -- moderation_notes may actually change.
    new.title := old.title;
    new.description := old.description;
    new.instructor_id := old.instructor_id;
    new.category_id := old.category_id;
    new.thumbnail_url := old.thumbnail_url;
    new.level := old.level;
    new.duration_hours := old.duration_hours;
    new.price := old.price;
    new.is_published := old.is_published;
  elsif not caller_is_reviewer then
    if new.moderation_status is distinct from old.moderation_status then
      new.moderation_status := old.moderation_status;
    end if;
    -- Publishing (false -> true) always re-queues for review, even if
    -- moderation_status still reads 'approved' from a prior publish
    -- cycle -- otherwise unpublish+republish would skip moderation.
    if new.is_published = true and old.is_published = false then
      new.moderation_status := 'pending';
      new.moderation_notes := null;
    end if;
  end if;

  return new;
end;
$$;
