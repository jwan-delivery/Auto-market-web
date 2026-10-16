-- الملهلب: initial Supabase schema
-- Run this in Supabase SQL Editor for project khgufiaxxitapbhxydaf.
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
 brand text not null, model text not null,
 year integer not null check (year between 1950 and 2100),
 price_sdg numeric(14,2) not null check (price_sdg >= 0),
 state text not null, car_type text, color text, transmission text, fuel text,
 document_type text check (document_type is null or document_type in ('وارد','شهادة بحث')),
 license_state text, phone text not null,
 image_urls text[] not null default '{}', video_url text, extra_description text,
 is_sold boolean not null default false, is_published boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.saved_searches (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 car_type text, brand text, color text, min_price numeric(14,2), max_price numeric(14,2),
 state text, min_year integer, max_year integer, document_type text, license_state text,
 created_at timestamptz not null default now()
);
create index if not exists cars_public_created_idx on public.cars (is_published, created_at desc);
create index if not exists cars_filter_idx on public.cars (brand, state, year, price_sdg);
create index if not exists saved_searches_user_idx on public.saved_searches (user_id);
alter table public.profiles enable row level security;
alter table public.cars enable row level security;
alter table public.saved_searches enable row level security;
create policy "profiles_read_own" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles_update_own_name" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "published_cars_public_read" on public.cars for select using (is_published = true);
create policy "admin_insert_cars" on public.cars for insert to authenticated with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "admin_update_cars" on public.cars for update to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')) with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "admin_delete_cars" on public.cars for delete to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "users_manage_own_searches" on public.saved_searches for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- After creating the first admin account in Supabase Auth, add their real UUID:
-- insert into public.profiles (id, display_name, role) values ('REAL-AUTH-USER-UUID', 'الملهلب', 'admin') on conflict (id) do update set role = 'admin';
