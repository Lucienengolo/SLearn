-- Founder request, 2026-07-29: a precise location (device geolocation, not
-- a typed address) so the matched instructor can navigate straight to the
-- family's home via a Google Maps link, plus a real edit/cancel path for a
-- request the parent already submitted -- there was previously no UPDATE
-- policy on tutor_requests at all, only SELECT.

alter table tutor_requests add column location_lat numeric;
alter table tutor_requests add column location_lng numeric;

create or replace function create_tutor_request(
  p_category_id uuid,
  p_grade text,
  p_neighborhood text,
  p_budget_min numeric,
  p_budget_max numeric,
  p_whatsapp_contact text,
  p_child_identifier text,
  p_preferred_language text default 'fr',
  p_location_lat numeric default null,
  p_location_lng numeric default null
) returns tutor_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing tutor_requests;
  v_new tutor_requests;
begin
  if p_preferred_language not in ('fr', 'en') then
    raise exception 'p_preferred_language must be fr or en';
  end if;

  select * into v_existing
  from tutor_requests
  where parent_id = auth.uid()
    and category_id = p_category_id
    and grade = p_grade
    and created_at > now() - interval '60 seconds'
  order by created_at desc
  limit 1;

  if found then
    return v_existing;
  end if;

  insert into tutor_requests (
    parent_id, category_id, grade, neighborhood, budget_min, budget_max,
    whatsapp_contact, child_identifier, preferred_language, location_lat, location_lng
  ) values (
    auth.uid(), p_category_id, p_grade, p_neighborhood, p_budget_min, p_budget_max,
    p_whatsapp_contact, p_child_identifier, p_preferred_language, p_location_lat, p_location_lng
  ) returning * into v_new;

  return v_new;
end;
$$;

-- Parents can edit their own request or cancel it -- but only while it's
-- still 'searching'. Once a tutor is matched, the instructor has already
-- committed to it; editing at that point would just be confusing, so it's
-- locked. Cancelling sets status to 'cancelled' (already a valid value in
-- the original check constraint), never a hard delete, consistent with how
-- matches/bookings already track state transitions rather than dropping
-- rows. `with check` deliberately does not allow 'matched' -- that
-- transition is the matching engine's alone.
create policy "parents edit or cancel their own still-searching request"
  on tutor_requests for update
  using (parent_id = (select auth.uid()) and status = 'searching')
  with check (parent_id = (select auth.uid()) and status in ('searching', 'cancelled'));
