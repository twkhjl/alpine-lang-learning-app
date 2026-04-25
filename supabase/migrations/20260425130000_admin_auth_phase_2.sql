create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create extension if not exists citext;

create table if not exists public.admin_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username citext not null unique,
  display_name text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.member_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
alter table public.admin_accounts enable row level security;
alter table public.member_profiles enable row level security;

drop policy if exists "Admin users can read own row" on public.admin_users;
create policy "Admin users can read own row"
  on public.admin_users for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Members can read own profile" on public.member_profiles;
create policy "Members can read own profile"
  on public.member_profiles for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Members can insert own profile" on public.member_profiles;
create policy "Members can insert own profile"
  on public.member_profiles for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Members can update own profile" on public.member_profiles;
create policy "Members can update own profile"
  on public.member_profiles for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select on public.admin_users to authenticated;
grant select, insert, update on public.member_profiles to authenticated;
