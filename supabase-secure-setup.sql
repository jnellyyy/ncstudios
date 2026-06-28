-- NC Studio secure Supabase setup
-- Before running:
-- 1. Create your login user in Supabase > Authentication > Users.
-- 2. Confirm the login email below exactly matches that user.

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

-- Structured CRM tables. The current app_storage records remain compatible while
-- these tables provide a clean path for the full business data model.
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  business_name text not null default 'NC Studio',
  timezone text not null default 'Europe/London',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  service_type text not null,
  name text not null,
  price numeric(10,2),
  coverage_hours text,
  deliverables jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.add_ons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  service_type text not null,
  name text not null,
  price numeric(10,2),
  price_note text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id text primary key,
  client_id text references public.clients(id) on delete set null,
  couple_names text not null,
  wedding_date date,
  ceremony_location text,
  reception_location text,
  service_type text,
  package_id uuid references public.packages(id) on delete set null,
  package_name text,
  pipeline_stage text not null default 'new-enquiry',
  total_price numeric(10,2) not null default 0,
  deposit_paid numeric(10,2) not null default 0,
  payment_status text not null default 'not requested',
  contract_status text not null default 'not sent',
  questionnaire_status text not null default 'not sent',
  next_action text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id text primary key,
  booking_id text references public.bookings(id) on delete cascade,
  client_name text,
  title text not null,
  category text not null default 'admin',
  priority text not null default 'medium',
  due_date date,
  status text not null default 'open',
  notes text,
  automation_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  booking_id text references public.bookings(id) on delete cascade,
  task_id text references public.tasks(id) on delete cascade,
  reminder_type text not null,
  remind_at timestamptz not null,
  channel text not null default 'in-app',
  status text not null default 'scheduled',
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id text references public.bookings(id) on delete cascade,
  amount numeric(10,2) not null default 0,
  payment_type text not null default 'balance',
  status text not null default 'not requested',
  due_date date,
  paid_date date,
  invoice_link text,
  reminder_count integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  booking_id text references public.bookings(id) on delete cascade,
  status text not null default 'pending',
  sent_at timestamptz,
  signed_at timestamptz,
  contract_link text,
  uploaded_file_link text,
  package_details text,
  payment_terms text,
  special_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.consultations (
  id text primary key,
  booking_id text references public.bookings(id) on delete cascade,
  consultation_type text not null default 'pre-wedding',
  scheduled_at timestamptz,
  status text not null default 'planned',
  notes text,
  actions jsonb not null default '[]'::jsonb,
  checklist jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wedding_timelines (
  id uuid primary key default gen_random_uuid(),
  booking_id text references public.bookings(id) on delete cascade,
  title text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  location text,
  notes text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.editing_projects (
  id text primary key,
  booking_id text references public.bookings(id) on delete cascade,
  status text not null default 'not-started',
  editing_start_date date,
  preview_sent_date date,
  delivery_due_date date,
  gallery_link text,
  video_link text,
  usb_needed boolean not null default false,
  album_needed boolean not null default false,
  review_requested boolean not null default false,
  posting_permission text not null default 'waiting',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.message_templates (
  id text primary key,
  title text not null,
  category text not null,
  body text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_plans (
  id text primary key,
  booking_id text references public.bookings(id) on delete set null,
  client_name text not null,
  wedding_date date,
  posting_permission text not null default 'waiting',
  best_images text,
  best_clips text,
  reel_idea text,
  caption_idea text,
  status text not null default 'idea',
  post_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.file_links (
  id uuid primary key default gen_random_uuid(),
  booking_id text references public.bookings(id) on delete cascade,
  client_id text references public.clients(id) on delete cascade,
  label text not null,
  file_type text,
  url text not null,
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

-- Every structured business table is private to authenticated NC Studio admins.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'user_profiles','packages','add_ons','bookings','tasks','reminders',
    'payments','contracts','consultations','wedding_timelines',
    'editing_projects','message_templates','content_plans','file_links'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format('drop policy if exists "nc admins manage data" on public.%I', table_name);
    execute format(
      'create policy "nc admins manage data" on public.%I for all to authenticated using (public.is_nc_admin()) with check (public.is_nc_admin())',
      table_name
    );
  end loop;
end $$;

insert into public.packages (slug,service_type,name,price,coverage_hours,deliverables)
values
  ('photo-mini','photography','Mini',300,'2 to 3 hours','["75 edited images","Registry or small wedding coverage"]'::jsonb),
  ('photo-half','photography','Half day',500,'4 to 5 hours','["150 edited images","Consultation","Travel within 30 miles of Sheffield"]'::jsonb),
  ('photo-full','photography','Full day',null,'Up to 8 hours','["300 edited images","Pre-wedding consultation","Timeline support","Travel within 30 miles of Sheffield"]'::jsonb),
  ('video-mini','videography','Mini',350,'Up to 2 hours','["1 to 2 minute highlight film","Ceremony and couple shots","Online delivery"]'::jsonb),
  ('video-half','videography','Half day',500,'Up to 5 hours','["3 to 4 minute cinematic highlight","Full ceremony film","Online delivery"]'::jsonb),
  ('video-full','videography','Full day',850,'Up to 10 hours','["6 to 8 minute cinematic highlight","Full ceremony film","Full speeches film","Online delivery"]'::jsonb)
on conflict (slug) do update set
  name=excluded.name,
  price=excluded.price,
  coverage_hours=excluded.coverage_hours,
  deliverables=excluded.deliverables,
  updated_at=now();

insert into public.add_ons (slug,service_type,name,price,price_note)
values
  ('photo-extra-hour','photography','Extra hour',100,'per hour'),
  ('photo-second-photographer','photography','Second photographer',250,null),
  ('photo-usb','photography','USB',50,null),
  ('photo-album','photography','Album',200,'from'),
  ('video-extra-hour','videography','Extra hour',100,'per hour'),
  ('video-second-videographer','videography','Second videographer',250,null),
  ('video-usb','videography','USB',50,null)
on conflict (slug) do update set
  name=excluded.name,
  price=excluded.price,
  price_note=excluded.price_note,
  updated_at=now();

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
