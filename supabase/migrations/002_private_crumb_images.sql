-- Keep uploaded images private; the application serves short-lived signed URLs.
update storage.buckets
set public = false
where id = 'crumb-images';

drop policy if exists "Public read access to crumb images" on storage.objects;
drop policy if exists "Users can view own images" on storage.objects;
create policy "Users can view own images"
  on storage.objects for select
  using (
    bucket_id = 'crumb-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Authenticated users can upload images" on storage.objects;
create policy "Authenticated users can upload images"
  on storage.objects for insert
  with check (
    bucket_id = 'crumb-images'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
