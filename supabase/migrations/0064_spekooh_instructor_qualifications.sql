-- Owner report, 2026-09-22: Spekooh was routing a paper to an instructor by
-- subject alone, with no check that the instructor is actually qualified
-- for that paper's level -- a secondary-level instructor could be reachable
-- for a university paper. Fix, on this side: an instructor states which of
-- Spekooh's own education-level categories they're qualified to mark, and
-- we push that to Spekooh (instructor_profile_update, see
-- supabase/functions/spekooh-qualifications) so its own routing can filter
-- on it. Spekooh's category list is fetched live from its partner API, not
-- hardcoded here, so the two can never drift apart.
--
-- Same "kept separate from profiles, not every instructor does this" shape
-- as tutor_profile_fields (0030_tutor_marketplace.sql) -- most instructors
-- never mark a Spekooh paper at all.
create table spekooh_instructor_qualifications (
  instructor_id uuid primary key references profiles(id) on delete cascade,
  -- Spekooh ExamCategory.key values, e.g. {secondary, university}. No FK/
  -- check against a fixed list here -- Spekooh owns that taxonomy and
  -- validates it again on its own side (upsert_instructor_profile) when we
  -- push it; this column just holds whatever the instructor last picked
  -- from the live list.
  qualified_categories text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create or replace function spekooh_instructor_qualifications_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger spekooh_instructor_qualifications_set_updated_at
  before update on spekooh_instructor_qualifications
  for each row execute function spekooh_instructor_qualifications_set_updated_at();

alter table spekooh_instructor_qualifications enable row level security;

-- An instructor manages only their own row -- no public-read policy (unlike
-- tutor_profile_fields, this is never shown on a public listing, only used
-- by the instructor themselves and the edge function that syncs it to
-- Spekooh). Not restricted to verified instructors at the RLS layer: the
-- real gate on whether this data ever matters is Spekooh's own ops team
-- manually adding an instructor_id to a subject's routing queue, not
-- whether a qualifications row exists here.
create policy "instructors manage their own spekooh qualifications"
  on spekooh_instructor_qualifications for all
  using (instructor_id = (select auth.uid()))
  with check (instructor_id = (select auth.uid()));
