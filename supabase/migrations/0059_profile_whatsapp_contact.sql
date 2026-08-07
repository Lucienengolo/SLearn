-- Founder observation, 2026-08-07: the WhatsApp number used in the tutor
-- request flow "is not for the dedicated user" -- tutor_requests.whatsapp_contact
-- is retyped from scratch on every single request (RequestForm.tsx has no
-- prefill from any prior value), so there's no guarantee it's consistent or
-- actually the requester's own number. Fix: capture it once at the profile
-- level -- optionally at signup, or the first time a parent submits a
-- request without one on file -- and reuse it everywhere after that.
alter table profiles add column whatsapp_contact text;

-- Optional at signup (raw_user_meta_data ->> 'whatsapp_contact' is simply
-- null when the signup form left it blank -- no branching needed), same
-- mechanism already used for full_name.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, verified, whatsapp_contact)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    'student',
    false,
    new.raw_user_meta_data ->> 'whatsapp_contact'
  );
  return new;
end;
$$;

-- profiles' SELECT grant is a deliberate column allowlist that excludes
-- email (0046_restrict_profile_email.sql), with the "profiles are publicly
-- readable" RLS policy still `using (true)` -- i.e. every row is visible to
-- every caller, only specific columns are hidden. whatsapp_contact must NOT
-- be added to that allowlist or to public_profiles: doing so would leak
-- every user's phone number to every other user, the exact class of bug
-- 0046 fixed for email. Instead, only the owner can read their own value,
-- via this narrow security-definer RPC -- same pattern as
-- get_match_tutor_email (0058) and get_application_applicant_email (0046).
create or replace function get_my_whatsapp_contact()
returns text
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select whatsapp_contact from profiles where id = auth.uid();
$$;

grant execute on function get_my_whatsapp_contact to authenticated;
