-- Enable UUID extension (already enabled in Supabase by default)
-- Run this migration in your Supabase SQL editor

-- ─── crumbs table ────────────────────────────────────────────────────────────
create table if not exists crumbs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  image_url   text not null,
  product_url text not null,
  category    text not null,
  title       text,
  created_at  timestamptz default now() not null
);

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table crumbs enable row level security;

-- Users can only view their own crumbs
create policy "Users can view own crumbs"
  on crumbs for select
  using (auth.uid() = user_id);

-- Users can only insert their own crumbs
create policy "Users can insert own crumbs"
  on crumbs for insert
  with check (auth.uid() = user_id);

-- Users can only update their own crumbs
create policy "Users can update own crumbs"
  on crumbs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can only delete their own crumbs
create policy "Users can delete own crumbs"
  on crumbs for delete
  using (auth.uid() = user_id);

-- ─── Storage bucket ───────────────────────────────────────────────────────────
-- Run these in the Storage section or via SQL:
insert into storage.buckets (id, name, public)
  values ('crumb-images', 'crumb-images', false)
  on conflict (id) do update set public = false;

-- Authenticated users can upload images
create policy "Authenticated users can upload images"
  on storage.objects for insert
  with check (
    bucket_id = 'crumb-images'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can only read images in their own folder
create policy "Users can view own images"
  on storage.objects for select
  using (
    bucket_id = 'crumb-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own uploaded images
create policy "Users can delete own images"
  on storage.objects for delete
  using (
    bucket_id = 'crumb-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
