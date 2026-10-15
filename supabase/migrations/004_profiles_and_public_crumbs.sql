-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 004: Public Profiles, Username Handles, and Username Sign-in
-- Allows users to create a unique @username, public profile, and sign in with username or email
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Profiles Table
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  email text,
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

-- 2. Username Lookups Table (for fast username -> email resolution during sign-in)
create table if not exists username_lookups (
  username text primary key,
  email text not null,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now() not null
);

create unique index if not exists idx_username_lookups_lower on username_lookups (lower(username));
alter table username_lookups enable row level security;

drop policy if exists "Public can resolve username lookups" on username_lookups;
create policy "Public can resolve username lookups"
  on username_lookups for select
  using (true);

drop policy if exists "Anyone can insert username lookup" on username_lookups;
create policy "Anyone can insert username lookup"
  on username_lookups for insert
  with check (true);

drop policy if exists "Users can update own username lookup" on username_lookups;
create policy "Users can update own username lookup"
  on username_lookups for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3. Security Definer function to resolve username to email
create or replace function get_email_for_username(p_username text)
returns text
language plpgsql
security definer
as $$
declare
  v_email text;
  v_clean text;
begin
  v_clean := lower(trim(replace(p_username, '@', '')));

  -- 1. Try username_lookups table
  select email into v_email
  from username_lookups
  where lower(username) = v_clean
  limit 1;

  if v_email is not null then
    return v_email;
  end if;

  -- 2. Try auth.users joined with profiles
  select u.email into v_email
  from auth.users u
  join profiles p on p.id = u.id
  where lower(p.username) = v_clean
  limit 1;
  
  if v_email is not null then
    return v_email;
  end if;

  -- 3. Try profiles table email column
  select email into v_email
  from profiles
  where lower(username) = v_clean and email is not null
  limit 1;

  return v_email;
end;
$$;

grant execute on function get_email_for_username(text) to anon, authenticated, service_role;

-- 4. Allow public access to crumbs if the user has public profile enabled
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

-- 5. Allow public read access to crumb-images storage bucket
drop policy if exists "Public can view crumb images" on storage.objects;
create policy "Public can view crumb images"
  on storage.objects for select
  using (bucket_id = 'crumb-images');
