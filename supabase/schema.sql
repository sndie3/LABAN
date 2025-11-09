-- LABAN: help requests schema and policies

-- Create table
create table if not exists public.help_requests (
  id uuid primary key default gen_random_uuid(),
  user_name text,
  message text not null,
  role text check (role in ('Civilian','Rescuer')),
  latitude double precision,
  longitude double precision,
  region text,
  status text default 'open',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS and allow public read/insert for demo
alter table public.help_requests enable row level security;

create policy "Public read help_requests"
  on public.help_requests
  for select
  to public
  using (true);

create policy "Public insert help_requests"
  on public.help_requests
  for insert
  to public
  with check (true);

-- Realtime configuration (Supabase listens automatically on tables)
-- No extra SQL is required for realtime.