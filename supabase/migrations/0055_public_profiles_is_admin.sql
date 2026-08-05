-- Bug found live, 2026-08-05: the founder logged in as the principal admin
-- (storefix237@gmail.com, is_admin=true in the database, confirmed) and
-- never saw the new Admin nav item. Root cause: AuthContext.fetchProfile()
-- reads from the `public_profiles` view (0046_restrict_profile_email.sql),
-- not `profiles` directly -- and that view has a fixed column list from
-- before is_admin existed. 0054_admin_role.sql added the column to the
-- base table but never touched the view or its column-level grant, so
-- profile.is_admin was undefined for every single user regardless of the
-- database's actual value -- not a caching issue, a genuine schema gap.
grant select (is_admin) on profiles to anon, authenticated;

-- is_admin appended at the end, not inserted after is_reviewer --
-- CREATE OR REPLACE VIEW requires existing column positions/names to stay
-- identical (only new columns may be added at the end); confirmed live
-- against ci_test that inserting it earlier in the list fails with
-- "cannot change name of view column ... to ...".
create or replace view public_profiles as
  select id, full_name, role, verified, is_reviewer, avatar_url, bio, totem, created_at, updated_at, is_admin
  from profiles;

-- CREATE OR REPLACE VIEW resets reloptions -- caught live against ci_test:
-- a successful replace silently cleared security_invoker (a no-op replace
-- that errors, as this migration's first draft did on the column-order
-- mistake, leaves it untouched, which is what falsely looked like it
-- "survived" during that draft). Re-apply it every time this view is
-- replaced, or 0049_view_security_invoker.sql's fix silently regresses.
alter view public_profiles set (security_invoker = on);
