-- ============================================================================
-- FoundrIQ AI — complete production backend for Supabase
-- Project: pquiietavzjznemtujvy
--
-- Paste this whole file into the Supabase SQL Editor and run it once.
-- It is idempotent: re-running it is safe.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Shared helpers
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- PROFILES
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  first_name text,
  last_name text,
  company text,
  role text,
  avatar_url text,
  dark_mode boolean not null default true,
  compact_layout boolean not null default false,
  keyboard_shortcuts boolean not null default true,
  ai_autopilot boolean not null default true,
  notify_blueprints boolean not null default true,
  notify_weekly_reports boolean not null default true,
  notify_product_updates boolean not null default true,
  notify_marketing boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (auth.uid() = id);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own" on public.profiles
  for delete to authenticated using (auth.uid() = id);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============================================================================
-- SETTINGS
-- ============================================================================
create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  theme text not null default 'dark',
  language text not null default 'en',
  timezone text not null default 'UTC',
  workspace jsonb not null default '{}'::jsonb,
  notifications jsonb not null default '{}'::jsonb,
  ai_preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists settings_user_id_idx on public.settings(user_id);
grant select, insert, update, delete on public.settings to authenticated;
grant all on public.settings to service_role;
alter table public.settings enable row level security;

drop policy if exists "settings_all_own" on public.settings;
create policy "settings_all_own" on public.settings
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists settings_set_updated_at on public.settings;
create trigger settings_set_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

-- ============================================================================
-- STARTUPS
-- ============================================================================
create table if not exists public.startups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  industry text,
  description text,
  problem text,
  solution text,
  target_audience text,
  revenue_model text,
  business_model text,
  marketing_strategy text,
  competitor_analysis text,
  pricing text,
  swot jsonb,
  investor_score integer,
  ai_confidence numeric,
  status text not null default 'active',
  report jsonb,
  inputs jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists startups_user_id_created_idx on public.startups(user_id, created_at desc);
grant select, insert, update, delete on public.startups to authenticated;
grant all on public.startups to service_role;
alter table public.startups enable row level security;

drop policy if exists "startups_all_own" on public.startups;
create policy "startups_all_own" on public.startups
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists startups_set_updated_at on public.startups;
create trigger startups_set_updated_at before update on public.startups
  for each row execute function public.set_updated_at();

-- ============================================================================
-- REPORTS
-- ============================================================================
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  startup_id uuid references public.startups(id) on delete cascade,
  title text not null,
  summary text,
  content jsonb not null default '{}'::jsonb,
  format text not null default 'json',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reports_user_id_created_idx on public.reports(user_id, created_at desc);
create index if not exists reports_startup_id_idx on public.reports(startup_id);
grant select, insert, update, delete on public.reports to authenticated;
grant all on public.reports to service_role;
alter table public.reports enable row level security;

drop policy if exists "reports_all_own" on public.reports;
create policy "reports_all_own" on public.reports
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists reports_set_updated_at on public.reports;
create trigger reports_set_updated_at before update on public.reports
  for each row execute function public.set_updated_at();

-- ============================================================================
-- HISTORY
-- ============================================================================
create table if not exists public.history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  startup_id uuid references public.startups(id) on delete cascade,
  action text not null,
  title text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists history_user_id_created_idx on public.history(user_id, created_at desc);
grant select, insert, update, delete on public.history to authenticated;
grant all on public.history to service_role;
alter table public.history enable row level security;

drop policy if exists "history_all_own" on public.history;
create policy "history_all_own" on public.history
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  type text not null default 'info',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_created_idx on public.notifications(user_id, created_at desc);
grant select, insert, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;

drop policy if exists "notifications_all_own" on public.notifications;
create policy "notifications_all_own" on public.notifications
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- AUTO-CREATE PROFILE + SETTINGS ON SIGNUP
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  v_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, email, full_name, first_name, last_name)
  values (
    new.id,
    new.email,
    v_name,
    split_part(v_name, ' ', 1),
    nullif(regexp_replace(v_name, '^\S+\s*', ''), '')
  )
  on conflict (id) do nothing;

  insert into public.settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- STORAGE: avatars bucket
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/png','image/jpeg','image/jpg','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- BACKFILL: profiles/settings for users that already exist
-- ============================================================================
insert into public.profiles (id, email, full_name)
select u.id, u.email, coalesce(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1))
from auth.users u
on conflict (id) do nothing;

insert into public.settings (user_id)
select u.id from auth.users u
on conflict (user_id) do nothing;
