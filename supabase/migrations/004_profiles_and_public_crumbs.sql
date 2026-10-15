-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 004: Public Profiles & Public Crumbs Sharing
-- Allows users to create a unique @username, public profile, and share their saved pieces
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Profiles Table
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  bio text default '',
  is_public boolean default true,
  followers_count integer default 0,
  following_count integer default 0,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Case-insensitive unique index on username
create unique index if not exists idx_profiles_username_lower on profiles (lower(username));

-- Enable Row Level Security
alter table profiles enable row level security;

-- Anyone (including unauthenticated visitors) can view profiles
drop policy if exists "Public can view profiles" on profiles;
create policy "Public can view profiles"
  on profiles for select
  using (true);

-- Authenticated users can insert their own profile
drop policy if exists "Users can insert own profile" on profiles;
create policy "Users can insert own profile"
  on profiles for insert
  with check (auth.uid() = id);

-- Authenticated users can update their own profile
drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 2. Allow public access to crumbs if the user has public profile enabled
drop policy if exists "Users can view own crumbs" on crumbs;
drop policy if exists "Users can view own crumbs or public crumbs" on crumbs;

create policy "Users can view own crumbs or public crumbs"
  on crumbs for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from profiles
      where profiles.id = crumbs.user_id
        and profiles.is_public = true
    )
  );

-- 3. Allow public read access to crumb-images storage bucket
drop policy if exists "Public can view crumb images" on storage.objects;
create policy "Public can view crumb images"
  on storage.objects for select
  using (bucket_id = 'crumb-images');
