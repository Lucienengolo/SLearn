-- CourseEditor was storing thumbnails as base64 data URIs directly in
-- courses.thumbnail_url (a plain text column) via FileReader.
-- readAsDataURL -- a 5MB image becomes ~6.7MB of text sitting in every
-- row read of that course, forever, instead of a real Storage upload
-- returning a short URL. Same owner-scoped-folder pattern as avatars
-- (0016) -- keyed by instructor_id rather than course_id specifically
-- so a brand-new course (no id yet) can still get a thumbnail uploaded
-- before the first save, the same chicken-and-egg problem lesson video/
-- PDF uploads still have (those are keyed by course_id).
insert into storage.buckets (id, name, public)
values ('course-thumbnails', 'course-thumbnails', true)
on conflict (id) do nothing;

create policy "instructors upload their own course thumbnails"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'course-thumbnails'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "instructors delete their own course thumbnails"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'course-thumbnails'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
