-- Founder feedback (2026-07-22): instructors already go through a full
-- verification process (V2) -- don't make them fill out a second form to
-- become a tutor. These fields are collected as an OPTIONAL section of the
-- SAME application (offers_tutoring gates whether the rest are shown/
-- required client-side), and instructor-approval populates
-- tutor_profile_fields/tutor_subjects directly from this data at approval
-- time. TutorProfileForm.tsx (0030) remains as an edit-later tool and as
-- the opt-in path for an already-approved instructor who skipped this
-- during application -- it is not being removed, just no longer the only
-- or first way to set this up.
--
-- Genuinely new information V2 never collected (not derivable from
-- areas_of_expertise/bio/qualifications): which specific catalog subjects
-- to tutor in, in-person neighborhood, a per-session tutoring rate, teaching
-- mode, response time, languages, and a tutoring-specific WhatsApp number.
alter table instructor_applications
  add column offers_tutoring boolean not null default false,
  add column tutoring_category_ids uuid[] not null default '{}',
  add column tutoring_neighborhood text,
  add column tutoring_teaching_mode text check (tutoring_teaching_mode in ('online', 'in_person', 'both')),
  add column tutoring_languages text[] not null default '{}',
  add column tutoring_rate_per_session numeric check (tutoring_rate_per_session is null or tutoring_rate_per_session > 0),
  add column tutoring_response_time_minutes integer,
  add column tutoring_whatsapp text;
