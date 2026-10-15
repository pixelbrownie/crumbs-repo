-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 003: Enrichment, Collections, and Capture Tokens
-- Backward-compatible schema upgrade for visual capture & smart auto-grouping
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Extend existing `crumbs` table
alter table crumbs
  add column if not exists tags text[] default '{}',
  add column if not exists item_type text,
  add column if not exists brand text,
  add column if not exists colors text[] default '{}',
  add column if not exists aesthetic text[] default '{}',
  add column if not exists source_domain text,
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'ready', 'failed')),
  add column if not exists original_image_url text,
  add column if not exists width integer,
  add column if not exists height integer,
  add column if not exists blur_data_url text;

-- Mark existing rows as 'ready' so their display is preserved
update crumbs
set status = 'ready'
where status = 'pending';

-- Index for deduplication and status filtering
create index if not exists idx_crumbs_user_product_url on crumbs (user_id, product_url);
create index if not exists idx_crumbs_user_status on crumbs (user_id, status);
create index if not exists idx_crumbs_user_created_at on crumbs (user_id, created_at desc);

-- 2. Smart Collections table
create table if not exists collections (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  kind        text not null check (kind in ('category', 'aesthetic', 'color', 'brand', 'custom')),
  slug        text not null,
  created_at  timestamptz default now() not null,
  constraint uq_user_collection_slug_kind unique (user_id, kind, slug)
);

alter table collections enable row level security;

create policy "Users can manage own collections"
  on collections for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_collections_user_kind on collections (user_id, kind);

-- 3. Crumb-Collections join table
create table if not exists crumb_collections (
  crumb_id      uuid references crumbs(id) on delete cascade not null,
  collection_id uuid references collections(id) on delete cascade not null,
  created_at    timestamptz default now() not null,
  primary key (crumb_id, collection_id)
);

alter table crumb_collections enable row level security;

-- Users can access junction rows if they own the underlying crumb
create policy "Users can access own crumb_collections"
  on crumb_collections for all
  using (
    exists (
      select 1 from crumbs c
      where c.id = crumb_collections.crumb_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from crumbs c
      where c.id = crumb_collections.crumb_id
        and c.user_id = auth.uid()
    )
  );

create index if not exists idx_crumb_collections_col on crumb_collections (collection_id);

-- 4. Extension / Bookmarklet Capture Tokens
create table if not exists capture_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  token_hash    text not null unique,
  label         text not null default 'browser extension',
  created_at    timestamptz default now() not null,
  last_used_at  timestamptz,
  revoked_at    timestamptz
);

alter table capture_tokens enable row level security;

create policy "Users can view and manage own capture tokens"
  on capture_tokens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_capture_tokens_hash on capture_tokens (token_hash)
  where revoked_at is null;
