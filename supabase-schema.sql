-- الملهلب: shared Supabase setup (safe to re-run).
-- Project: https://khgufiaxxitapbhxydaf.supabase.co
-- Run once (or re-run safely) in Supabase Dashboard -> SQL Editor.
-- IMPORTANT: never place a service_role/secret key in browser code.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.cars (
  id uuid primary key default gen_random_uuid(),
  offer_number text not null unique,
  owner_id uuid references auth.users(id) on delete set null,
  brand text not null,
  model text not null,
  year integer not null check (year between 1950 and 2100),
  price_sdg numeric(14,2) not null check (price_sdg >= 0),
  state text not null,
  car_type text,
  color text,
  transmission text,
  fuel text,
  document_type text check (document_type is null or document_type in ('وارد','شهادة بحث')),
  license_state text,
  phone text not null,
  image_urls text[] not null default '{}',
  video_url text,
  extra_description text,
  is_sold boolean not null default false,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  car_type text,
  brand text,
  color text,
  min_price numeric(14,2),
  max_price numeric(14,2),
  state text,
  min_year integer,
  max_year integer,
  document_type text,
  license_state text,
  created_at timestamptz not null default now()
);

create index if not exists cars_public_created_idx on public.cars (is_published, created_at desc);
create index if not exists cars_filter_idx on public.cars (brand, state, year, price_sdg);
create index if not exists saved_searches_user_idx on public.saved_searches (user_id);

-- Create one profile for every new auth account. A new account is never an admin by default.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)),
    'user'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- SECURITY DEFINER avoids recursive RLS checks while safely checking the current profile.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.cars enable row level security;
alter table public.saved_searches enable row level security;

-- Remove old policies first so re-running this file does not create duplicates or preserve
-- the old self-update policy that could let a user attempt to change their own role.
drop policy if exists profiles_read_own on public.profiles;
drop policy if exists profiles_update_own_name on public.profiles;
drop policy if exists cars_public_read on public.cars;
drop policy if exists published_cars_public_read on public.cars;
drop policy if exists cars_admin_read_all on public.cars;
drop policy if exists admin_insert_cars on public.cars;
drop policy if exists admin_update_cars on public.cars;
drop policy if exists admin_delete_cars on public.cars;
drop policy if exists saved_searches_owner_access on public.saved_searches;
drop policy if exists users_manage_own_searches on public.saved_searches;

create policy profiles_read_own
on public.profiles for select to authenticated
using (id = auth.uid());

-- No profile INSERT/UPDATE/DELETE policy is provided to browser users. Profile creation is handled
-- by the secure auth trigger; set the first admin using the SQL below after registering the account.

create policy cars_public_read
on public.cars for select to anon, authenticated
using (is_published = true);

create policy cars_admin_read_all
on public.cars for select to authenticated
using (public.is_admin());

create policy cars_admin_insert
on public.cars for insert to authenticated
with check (public.is_admin());

create policy cars_admin_update
on public.cars for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy cars_admin_delete
on public.cars for delete to authenticated
using (public.is_admin());

create policy saved_searches_owner_access
on public.saved_searches for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant select on public.cars to anon, authenticated;
grant insert, update, delete on public.cars to authenticated;
grant select on public.profiles to authenticated;
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select, insert, update, delete on public.saved_searches to authenticated;

-- Publicly readable bucket: photo viewing works without login; only admins can upload/change/remove.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'car-images',
  'car-images',
  true,
  8388608,
  array['image/jpeg','image/png','image/webp','image/avif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists car_images_public_read on storage.objects;
drop policy if exists car_images_admin_insert on storage.objects;
drop policy if exists car_images_admin_update on storage.objects;
drop policy if exists car_images_admin_delete on storage.objects;

create policy car_images_public_read
on storage.objects for select to anon, authenticated
using (bucket_id = 'car-images');

create policy car_images_admin_insert
on storage.objects for insert to authenticated
with check (bucket_id = 'car-images' and public.is_admin());

create policy car_images_admin_update
on storage.objects for update to authenticated
using (bucket_id = 'car-images' and public.is_admin())
with check (bucket_id = 'car-images' and public.is_admin());

create policy car_images_admin_delete
on storage.objects for delete to authenticated
using (bucket_id = 'car-images' and public.is_admin());

-- FIRST ADMIN SETUP:
-- 1) Create an account through the website and confirm its email (if email confirmation is enabled).
-- 2) Replace the example email below with that exact email and run this SQL:
-- insert into public.profiles (id, display_name, role)
-- select id, 'الملهلب', 'admin' from auth.users where email = 'YOUR_EMAIL@example.com'
-- on conflict (id) do update set role = 'admin';
--
-- Check that one row was inserted/updated. Do not let ordinary users edit the role.
