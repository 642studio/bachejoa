create extension if not exists "pgcrypto";
create extension if not exists "pg_cron";

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  lat double precision not null,
  lng double precision not null,
  type text not null,
  category text not null default 'Baches',
  subcategory text not null default 'Grieta',
  status text not null default 'Visible',
  photo_url text,
  angry_count integer not null default 0,
  repaired boolean not null default false,
  repaired_at timestamptz,
  repair_rating_avg numeric(3, 2) not null default 0,
  repair_rating_count integer not null default 0,
  user_id uuid,
  reporter_fingerprint text
);

alter table public.reports add column if not exists category text;
alter table public.reports add column if not exists subcategory text;
alter table public.reports add column if not exists status text;
alter table public.reports add column if not exists user_id uuid;
alter table public.reports add column if not exists reporter_fingerprint text;

update public.reports
set
  category = coalesce(category, 'Baches'),
  subcategory = coalesce(subcategory, type, 'Grieta'),
  status = coalesce(
    status,
    case
      when repaired = true then 'Reparado'
      else 'Visible'
    end
  )
where category is null
  or subcategory is null
  or status is null;

alter table public.reports
  alter column category set default 'Baches',
  alter column subcategory set default 'Grieta',
  alter column status set default 'Visible';

alter table public.reports
  alter column category set not null,
  alter column subcategory set not null,
  alter column status set not null;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  email text not null,
  role text not null default 'citizen',
  avatar_key text not null default 'bart.svg',
  password_hash text not null,
  created_at timestamptz not null default now(),
  unique (username),
  unique (email)
);

alter table public.users add column if not exists role text;
alter table public.users add column if not exists avatar_key text;
alter table public.users add column if not exists email_verified_at timestamptz;
alter table public.users add column if not exists auth_provider text not null default 'legacy';
alter table public.users alter column password_hash drop not null;
update public.users set role = 'citizen' where role is null;
update public.users set avatar_key = 'bart.svg' where avatar_key is null;
update public.users set auth_provider = 'legacy' where auth_provider is null;
alter table public.users alter column role set default 'citizen';
alter table public.users alter column role set not null;
alter table public.users alter column avatar_key set default 'bart.svg';
alter table public.users alter column avatar_key set not null;
alter table public.users alter column auth_provider set default 'legacy';
alter table public.users alter column auth_provider set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_role_check'
  ) then
    alter table public.users
      add constraint users_role_check
      check (role in ('citizen', 'admin'));
  end if;
end;
$$;

create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.user_sessions add column if not exists ip_address text;
alter table public.user_sessions add column if not exists user_agent text;
alter table public.user_sessions add column if not exists last_used_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reports_user_id_fkey'
  ) then
    alter table public.reports
      add constraint reports_user_id_fkey
      foreign key (user_id) references public.users(id) on delete set null;
  end if;
end;
$$;

create index if not exists reports_created_at_idx on public.reports (created_at desc);
create index if not exists reports_user_id_idx on public.reports (user_id);
create index if not exists reports_reporter_fingerprint_idx on public.reports (reporter_fingerprint);
create index if not exists reports_status_idx on public.reports (status);
create index if not exists reports_category_idx on public.reports (category);
create index if not exists users_email_idx on public.users (email);
create index if not exists users_username_idx on public.users (username);
create index if not exists user_sessions_user_id_idx on public.user_sessions (user_id);
create index if not exists user_sessions_expires_at_idx on public.user_sessions (expires_at);
create index if not exists user_sessions_last_used_at_idx on public.user_sessions (last_used_at desc);

create table if not exists public.report_angry_votes (
  id bigint generated by default as identity primary key,
  report_id uuid not null references public.reports (id) on delete cascade,
  fingerprint text not null,
  created_at timestamptz not null default now(),
  unique (report_id, fingerprint)
);
create index if not exists report_angry_votes_fingerprint_idx
  on public.report_angry_votes (fingerprint);

create table if not exists public.report_repair_ratings (
  id bigint generated by default as identity primary key,
  report_id uuid not null references public.reports (id) on delete cascade,
  fingerprint text not null,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  unique (report_id, fingerprint)
);

create table if not exists public.rate_limits (
  key text primary key,
  fingerprint text not null,
  route text not null,
  window_start timestamptz not null,
  count integer not null default 0
);

create or replace function public.rate_limit_hit(
  p_key text,
  p_route text,
  p_fingerprint text,
  p_window_start timestamptz,
  p_limit int
) returns table (allowed boolean, current_count int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into public.rate_limits (key, fingerprint, route, window_start, count)
  values (p_key, p_fingerprint, p_route, p_window_start, 1)
  on conflict (key) do update
    set count = public.rate_limits.count + 1
  returning count into v_count;

  return query select (v_count <= p_limit), v_count;
end;
$$;

create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text not null,
  topic text,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id bigint generated by default as identity primary key,
  actor_type text not null check (actor_type in ('user', 'official', 'system')),
  actor_id uuid,
  action text not null,
  resource_type text not null,
  resource_id text not null,
  metadata jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists contact_requests_created_at_idx
  on public.contact_requests (created_at desc);
create index if not exists audit_log_resource_idx
  on public.audit_log (resource_type, resource_id);
create index if not exists audit_log_actor_idx
  on public.audit_log (actor_type, actor_id);
create index if not exists audit_log_created_at_idx
  on public.audit_log (created_at desc);

create table if not exists public.official_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  full_name text not null,
  email text,
  area text,
  categories text[] not null default '{}',
  zones text[] not null default '{}',
  active boolean not null default true,
  password_hash text not null,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

alter table public.official_accounts add column if not exists zones text[] not null default '{}';

create table if not exists public.official_sessions (
  id uuid primary key default gen_random_uuid(),
  official_id uuid not null references public.official_accounts (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.official_sessions add column if not exists ip_address text;
alter table public.official_sessions add column if not exists user_agent text;
alter table public.official_sessions add column if not exists last_used_at timestamptz not null default now();

create index if not exists official_accounts_username_idx
  on public.official_accounts (username);
create index if not exists official_accounts_active_idx
  on public.official_accounts (active);
create index if not exists official_accounts_zones_gin_idx
  on public.official_accounts using gin (zones);
create index if not exists official_sessions_official_id_idx
  on public.official_sessions (official_id);
create index if not exists official_sessions_expires_at_idx
  on public.official_sessions (expires_at);
create index if not exists official_sessions_last_used_at_idx
  on public.official_sessions (last_used_at desc);

create table if not exists public.zones (
  id text primary key,
  name text not null,
  lat_min double precision not null,
  lat_max double precision not null,
  lng_min double precision not null,
  lng_max double precision not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.zones (id, name, lat_min, lat_max, lng_min, lng_max)
values
  ('centro', 'Centro', 27.0705, 27.091, -109.457, -109.421),
  ('norte', 'Norte', 27.091, 27.125, -109.472, -109.404),
  ('sur', 'Sur', 27.035, 27.0705, -109.474, -109.404),
  ('poniente', 'Poniente', 27.058, 27.105, -109.52, -109.457),
  ('oriente', 'Oriente', 27.058, 27.105, -109.421, -109.36)
on conflict (id) do update set
  name = excluded.name,
  lat_min = excluded.lat_min,
  lat_max = excluded.lat_max,
  lng_min = excluded.lng_min,
  lng_max = excluded.lng_max;

create or replace function public.refresh_angry_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.reports
  set angry_count = (
    select count(*)::integer
    from public.report_angry_votes
    where report_id = coalesce(new.report_id, old.report_id)
  )
  where id = coalesce(new.report_id, old.report_id);
  return null;
end;
$$;

drop trigger if exists angry_votes_refresh on public.report_angry_votes;
create trigger angry_votes_refresh
after insert or delete on public.report_angry_votes
for each row execute function public.refresh_angry_count();

create or replace function public.refresh_repair_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.reports
  set
    repair_rating_avg = coalesce((
      select avg(rating)::numeric(3, 2)
      from public.report_repair_ratings
      where report_id = coalesce(new.report_id, old.report_id)
    ), 0),
    repair_rating_count = (
      select count(*)::integer
      from public.report_repair_ratings
      where report_id = coalesce(new.report_id, old.report_id)
    )
  where id = coalesce(new.report_id, old.report_id);
  return null;
end;
$$;

drop trigger if exists repair_ratings_refresh on public.report_repair_ratings;
create trigger repair_ratings_refresh
after insert or update or delete on public.report_repair_ratings
for each row execute function public.refresh_repair_rating();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reports_lat_check') then
    alter table public.reports
      add constraint reports_lat_check check (lat between -90 and 90) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reports_lng_check') then
    alter table public.reports
      add constraint reports_lng_check check (lng between -180 and 180) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reports_status_check') then
    alter table public.reports
      add constraint reports_status_check
      check (status in ('Creado', 'Visible', 'Verificado', 'En revisión', 'Reparado', 'Archivado')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reports_category_check') then
    alter table public.reports
      add constraint reports_category_check
      check (category in ('Baches', 'Luminarias', 'Agua', 'Basura', 'Drenaje')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'users_email_format_check') then
    alter table public.users
      add constraint users_email_format_check
      check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'users_auth_provider_check') then
    alter table public.users
      add constraint users_auth_provider_check
      check (auth_provider in ('legacy', 'supabase')) not valid;
  end if;
end;
$$;

select cron.schedule(
  'cleanup-rate-limits',
  '0 * * * *',
  $$ delete from public.rate_limits where window_start < now() - interval '24 hours' $$
)
where not exists (
  select 1 from cron.job where jobname = 'cleanup-rate-limits'
);

select cron.schedule(
  'cleanup-expired-sessions',
  '15 * * * *',
  $$ delete from public.user_sessions where expires_at < now();
     delete from public.official_sessions where expires_at < now(); $$
)
where not exists (
  select 1 from cron.job where jobname = 'cleanup-expired-sessions'
);

do $$
declare
  table_name text;
  policy_name text;
begin
  foreach table_name in array array[
    'audit_log',
    'contact_requests',
    'reports',
    'report_angry_votes',
    'report_repair_ratings',
    'rate_limits',
    'users',
    'user_sessions',
    'official_accounts',
    'official_sessions'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I enable row level security', table_name);

      policy_name := format('%s_service_role_all', table_name);
      execute format('drop policy if exists %I on public.%I', policy_name, table_name);
      execute format(
        'create policy %I on public.%I for all to service_role using (true) with check (true)',
        policy_name,
        table_name
      );
    end if;
  end loop;
end
$$;
