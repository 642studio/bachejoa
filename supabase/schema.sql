create extension if not exists "pgcrypto";

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  lat double precision not null,
  lng double precision not null,
  type text not null,
  photo_url text
);

create index if not exists reports_created_at_idx on public.reports (created_at desc);
