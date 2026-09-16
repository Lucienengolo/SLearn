-- Founder request, 2026-09-16: an instructor should actually see the real
-- question paper they're producing a marking guide for, and should be able
-- to upload the guide as a file instead of only the structured form.

-- 1. The real question-paper PDF's URL, now included in Spekooh's
-- new_request push (apps.instructors.outbound.notify_new_request).
alter table spekooh_marking_requests add column if not exists paper_file_url text;

-- 2. Our own record of an uploaded guide file's storage path (the private
-- signed URL sent to Spekooh is ephemeral and re-derived on demand from
-- this path -- see spekooh-respond -- not worth storing itself).
alter table spekooh_marking_requests add column if not exists guide_storage_path text;

-- 3. Private storage for instructor-uploaded guide files -- same
-- path-scoped-to-own-folder pattern as instructor-credentials
-- (0002_instructor_verification.sql): (storage.foldername(name))[1] must be
-- the uploader's own auth.uid().
insert into storage.buckets (id, name, public)
values ('marking-guides', 'marking-guides', false)
on conflict (id) do nothing;

drop policy if exists "instructors upload to their own marking-guide folder" on storage.objects;

create policy "instructors upload to their own marking-guide folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'marking-guides'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "instructors view their own marking-guide files" on storage.objects;

create policy "instructors view their own marking-guide files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'marking-guides'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
