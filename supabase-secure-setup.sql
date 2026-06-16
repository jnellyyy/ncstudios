-- NC Studio secure Supabase setup
-- Before running:
-- 1. Create your login user in Supabase > Authentication > Users.
-- 2. Replace YOUR_LOGIN_EMAIL_HERE below with that exact email.

begin;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

insert into public.admin_users (user_id)
select id
from auth.users
where lower(email) = lower('janelle.lamptey@gmail.com')
on conflict (user_id) do nothing;

create or replace function public.is_nc_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

create table if not exists public.app_storage (
  app_key text primary key,
  data jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.website_enquiries (
  id text primary key,
  data jsonb not null,
  status text not null default 'new',
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.website_messages (
  id text primary key,
  data jsonb not null,
  status text not null default 'new',
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id text primary key,
  full_name text not null default '',
  phone text,
  email text,
  event_date date,
  status text not null default 'lead',
  main_location text,
  key_link text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
alter table public.app_storage enable row level security;
alter table public.website_enquiries enable row level security;
alter table public.website_messages enable row level security;
alter table public.clients enable row level security;

grant usage on schema public to anon, authenticated;
grant execute on function public.is_nc_admin() to anon, authenticated;
grant select on public.app_storage to anon;
grant select, insert, update, delete on public.app_storage to authenticated;
grant insert on public.website_enquiries to anon, authenticated;
grant insert on public.website_messages to anon, authenticated;
grant select, update, delete on public.website_enquiries to authenticated;
grant select, update, delete on public.website_messages to authenticated;
grant select, insert, update, delete on public.clients to authenticated;

drop policy if exists "allow app storage read" on public.app_storage;
drop policy if exists "allow app storage insert" on public.app_storage;
drop policy if exists "allow app storage update" on public.app_storage;
drop policy if exists "allow app storage delete" on public.app_storage;
drop policy if exists "public can read live website content" on public.app_storage;
drop policy if exists "nc admins can read app storage" on public.app_storage;
drop policy if exists "nc admins can insert app storage" on public.app_storage;
drop policy if exists "nc admins can update app storage" on public.app_storage;
drop policy if exists "nc admins can delete app storage" on public.app_storage;

create policy "public can read live website content"
on public.app_storage
for select
to anon, authenticated
using (app_key = 'website_content_live' or public.is_nc_admin());

create policy "nc admins can insert app storage"
on public.app_storage
for insert
to authenticated
with check (public.is_nc_admin());

create policy "nc admins can update app storage"
on public.app_storage
for update
to authenticated
using (public.is_nc_admin())
with check (public.is_nc_admin());

create policy "nc admins can delete app storage"
on public.app_storage
for delete
to authenticated
using (public.is_nc_admin());

drop policy if exists "public can create website enquiries" on public.website_enquiries;
drop policy if exists "nc admins can read website enquiries" on public.website_enquiries;
drop policy if exists "nc admins can update website enquiries" on public.website_enquiries;
drop policy if exists "nc admins can delete website enquiries" on public.website_enquiries;

create policy "public can create website enquiries"
on public.website_enquiries
for insert
to anon, authenticated
with check (status = 'new' and imported_at is null);

create policy "nc admins can read website enquiries"
on public.website_enquiries
for select
to authenticated
using (public.is_nc_admin());

create policy "nc admins can update website enquiries"
on public.website_enquiries
for update
to authenticated
using (public.is_nc_admin())
with check (public.is_nc_admin());

create policy "nc admins can delete website enquiries"
on public.website_enquiries
for delete
to authenticated
using (public.is_nc_admin());

drop policy if exists "public can create website messages" on public.website_messages;
drop policy if exists "nc admins can read website messages" on public.website_messages;
drop policy if exists "nc admins can update website messages" on public.website_messages;
drop policy if exists "nc admins can delete website messages" on public.website_messages;

create policy "public can create website messages"
on public.website_messages
for insert
to anon, authenticated
with check (status = 'new' and imported_at is null);

create policy "nc admins can read website messages"
on public.website_messages
for select
to authenticated
using (public.is_nc_admin());

create policy "nc admins can update website messages"
on public.website_messages
for update
to authenticated
using (public.is_nc_admin())
with check (public.is_nc_admin());

create policy "nc admins can delete website messages"
on public.website_messages
for delete
to authenticated
using (public.is_nc_admin());

drop policy if exists "nc admins can read clients" on public.clients;
drop policy if exists "nc admins can insert clients" on public.clients;
drop policy if exists "nc admins can update clients" on public.clients;
drop policy if exists "nc admins can delete clients" on public.clients;

create policy "nc admins can read clients"
on public.clients
for select
to authenticated
using (public.is_nc_admin());

create policy "nc admins can insert clients"
on public.clients
for insert
to authenticated
with check (public.is_nc_admin());

create policy "nc admins can update clients"
on public.clients
for update
to authenticated
using (public.is_nc_admin())
with check (public.is_nc_admin());

create policy "nc admins can delete clients"
on public.clients
for delete
to authenticated
using (public.is_nc_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-media',
  'site-media',
  true,
  524288000,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

grant select on storage.objects to anon, authenticated;
grant insert, update, delete on storage.objects to authenticated;

drop policy if exists "public can read site media" on storage.objects;
drop policy if exists "nc admins can upload site media" on storage.objects;
drop policy if exists "nc admins can update site media" on storage.objects;
drop policy if exists "nc admins can delete site media" on storage.objects;

create policy "public can read site media"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'site-media');

create policy "nc admins can upload site media"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'site-media' and public.is_nc_admin());

create policy "nc admins can update site media"
on storage.objects
for update
to authenticated
using (bucket_id = 'site-media' and public.is_nc_admin())
with check (bucket_id = 'site-media' and public.is_nc_admin());

create policy "nc admins can delete site media"
on storage.objects
for delete
to authenticated
using (bucket_id = 'site-media' and public.is_nc_admin());

commit;
