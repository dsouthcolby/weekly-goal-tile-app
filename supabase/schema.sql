-- Weekly Tracker database for Supabase.
-- Run once: Supabase dashboard > SQL Editor > New query > paste this file > Run.
-- Safe to run again; it only creates what is missing and replaces the rules.

-- One row per person: their tiles, rewards and settings.
create table if not exists public.libraries (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at bigint not null default 0,          -- when the person last edited it (ms, from their device)
  synced_at  timestamptz not null default now()  -- when the server last saved it
);

-- One row per tile placed on a day, or per treat bought (kind = 'buy', tile_id = the treat's id).
-- Removing one sets deleted = true so the removal syncs.
create table if not exists public.placements (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id         text not null,
  kind       text not null default 'tile' check (kind in ('tile', 'buy')),  -- a placed tile, or a treat bought
  week       date not null,                      -- first day of the week the tile is in
  day        smallint not null check (day between 0 and 6),
  tile_id    text not null default '',
  name       text not null default '',
  points     integer not null default 0,
  color      smallint not null default 0,
  deleted    boolean not null default false,
  created_at bigint not null default 0,
  updated_at bigint not null default 0,
  synced_at  timestamptz not null default now(),
  primary key (user_id, id)
);
-- For databases created before treats could be bought.
alter table public.placements add column if not exists kind text not null default 'tile' check (kind in ('tile', 'buy'));
create index if not exists placements_user_synced on public.placements (user_id, synced_at);

-- When two devices save the same record, keep the newer edit. Also stamp the server time,
-- which the app uses to fetch only what changed since it last synced.
create or replace function public.tile_week_keep_newer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null;
  end if;
  new.synced_at := clock_timestamp();
  return new;
end
$$;

drop trigger if exists keep_newer on public.libraries;
create trigger keep_newer before insert or update on public.libraries
  for each row execute function public.tile_week_keep_newer();

drop trigger if exists keep_newer on public.placements;
create trigger keep_newer before insert or update on public.placements
  for each row execute function public.tile_week_keep_newer();

-- Access rules: a signed-in person can read and write only their own rows.
alter table public.libraries enable row level security;
alter table public.placements enable row level security;

drop policy if exists "own rows" on public.libraries;
create policy "own rows" on public.libraries
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "own rows" on public.placements;
create policy "own rows" on public.placements
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.libraries, public.placements from anon;
grant select, insert, update on public.libraries, public.placements to authenticated;
