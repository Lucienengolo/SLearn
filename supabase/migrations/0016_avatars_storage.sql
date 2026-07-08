-- Public avatar storage for the account settings page. Same
-- owner-scoped-folder pattern as instructor-credentials (0002) and
-- lesson-videos/lesson-pdfs (0001), but public since avatars are meant
-- to be visible to anyone (they render in the header, course reviews,
-- instructor bios, etc.) — unlike instructor-credentials, which are
-- private identity documents.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "users upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users update their own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users delete their own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- No explicit SELECT policy needed: public=true buckets are served via
-- the /storage/v1/object/public/... endpoint, which bypasses RLS
-- entirely (same as lesson-videos/lesson-pdfs in 0001, which have no
-- SELECT policy either).
