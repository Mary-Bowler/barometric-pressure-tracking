-- ============================================================
-- 001_initial.sql — barometric tracker v2 (multi-user, clean schema)
-- ============================================================

-- profiles: auto-created by trigger on signup
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- user_settings: one row per user (replaces the old global key/value `settings` table)
create table user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  location_lat numeric(9,6) not null,
  location_lng numeric(9,6) not null,
  location_label text not null default '',
  alert_threshold_mbar numeric(6,2) not null default 6.0,
  alert_threshold_hours numeric(6,2) not null default 3.0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- pressure_events
create table pressure_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  event_start timestamptz not null,
  event_end timestamptz,
  direction text not null check (direction in ('rising', 'falling')),
  forecasted_change_mbar numeric(6,2) not null,
  forecasted_duration_hrs numeric(6,2) not null,
  rate_mbar_hr numeric(6,4) generated always as
    (forecasted_change_mbar / nullif(forecasted_duration_hrs, 0)) stored,
  first_intervention_at timestamptz,
  actual_pressure_start numeric(7,2),
  actual_pressure_end numeric(7,2),
  source text default 'auto' check (source in ('auto', 'manual')),
  notes text,
  status text default 'active' check (status in ('active', 'completed')),
  midpoint_due_at timestamptz,
  peak_due_at timestamptz,
  midpoint_notified_at timestamptz,
  peak_notified_at timestamptz
);

-- symptom_checkins
create table symptom_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  event_id uuid references pressure_events(id) on delete cascade,
  recorded_at timestamptz not null default now(),
  entry_method text default 'pwa' check (entry_method in ('pwa')),
  severity integer not null check (severity >= 0 and severity <= 10),
  symptom_types text[] not null default '{}',
  note text,
  prompt_type text check (prompt_type in ('start', 'midpoint', 'peak', 'manual'))
);

-- interventions (triptan and ubrelvy added; benadryl_gcal source removed)
create table interventions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  event_id uuid references pressure_events(id) on delete cascade,
  checkin_id uuid references symptom_checkins(id) on delete set null,
  recorded_at timestamptz not null default now(),
  type text not null check (type in (
    'movement', 'rest', 'benadryl', 'triptan', 'ubrelvy', 'hydration', 'other'
  )),
  perceived_effectiveness integer check (perceived_effectiveness >= 0 and perceived_effectiveness <= 10),
  source text default 'manual' check (source in ('manual')),
  notes text
);

-- push_subscriptions: VAPID Web Push endpoint per user/device
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

-- Indexes
create index pressure_events_user_idx    on pressure_events(user_id);
create index symptom_checkins_user_idx   on symptom_checkins(user_id);
create index interventions_user_idx      on interventions(user_id);
create index push_subscriptions_user_idx on push_subscriptions(user_id);

-- event_outcomes view (security_invoker respects caller's RLS; user_id in GROUP BY)
create view event_outcomes with (security_invoker = true) as
select
  pe.user_id,
  pe.id,
  pe.event_start,
  pe.direction,
  pe.forecasted_change_mbar,
  pe.forecasted_duration_hrs,
  pe.rate_mbar_hr,
  max(sc.severity) as peak_severity,
  round(avg(sc.severity)::numeric, 2) as avg_severity,
  count(sc.id) as checkin_count,
  extract(epoch from (pe.first_intervention_at - pe.event_start)) / 3600
    as hours_to_first_intervention
from pressure_events pe
left join symptom_checkins sc on sc.event_id = pe.id
group by pe.user_id, pe.id;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table profiles           enable row level security;
alter table user_settings      enable row level security;
alter table push_subscriptions enable row level security;
alter table pressure_events    enable row level security;
alter table symptom_checkins   enable row level security;
alter table interventions      enable row level security;

-- profiles: users see/edit only their own row
create policy profiles_select on profiles for select using (auth.uid() = id);
create policy profiles_insert on profiles for insert with check (auth.uid() = id);
create policy profiles_update on profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

-- all data tables: scoped to user_id = auth.uid()
create policy us_all on user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy ps_all on push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy pe_all on pressure_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy sc_all on symptom_checkins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy iv_all on interventions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- The service-role key bypasses RLS — cron and push routes use it for cross-user access.
