-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 005: Follows and Social Connections
-- Allows users to follow other creators/profiles and track followers & following
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists follows (
  follower_id uuid references auth.users(id) on delete cascade not null,
  following_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  primary key (follower_id, following_id)
);

-- Indexes for fast follower / following lookups
create index if not exists idx_follows_follower on follows (follower_id);
create index if not exists idx_follows_following on follows (following_id);

-- Enable Row Level Security
alter table follows enable row level security;

-- Policies
drop policy if exists "Public can view follows" on follows;
create policy "Public can view follows"
  on follows for select
  using (true);

drop policy if exists "Authenticated users can follow" on follows;
create policy "Authenticated users can follow"
  on follows for insert
  with check (auth.uid() = follower_id and follower_id != following_id);

drop policy if exists "Authenticated users can unfollow" on follows;
create policy "Authenticated users can unfollow"
  on follows for delete
  using (auth.uid() = follower_id);
