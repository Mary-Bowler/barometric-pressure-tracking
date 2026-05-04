-- Settings table
create table settings (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

insert into settings (key, value) values
  ('location_lat', '34.2334'),
  ('location_lng', '-96.7167'),
  ('location_label', 'Kingston, OK'),
  ('alert_threshold_mbar', '6'),
  ('alert_threshold_hours', '3'),
  ('slack_webhook_url', '');

-- Pressure events
create table pressure_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  event_start timestamptz not null,
  event_end timestamptz,
  direction text not null check (direction in ('rising', 'falling')),
  forecasted_change_mbar numeric(6,2) not null,
  forecasted_duration_hrs numeric(6,2) not null,
  rate_mbar_hr numeric(6,4) generated always as (
    forecasted_change_mbar / nullif(forecasted_duration_hrs, 0)
  ) stored,
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

-- Symptom check-ins
create table symptom_checkins (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  event_id uuid references pressure_events(id) on delete cascade,
  recorded_at timestamptz not null default now(),
  entry_method text default 'pwa' check (entry_method in ('pwa', 'slack')),
  severity integer not null check (severity >= 0 and severity <= 10),
  symptom_types text[] not null default '{}',
  note text,
  prompt_type text check (prompt_type in ('start', 'midpoint', 'peak', 'manual'))
);

-- Interventions
create table interventions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  event_id uuid references pressure_events(id) on delete cascade,
  checkin_id uuid references symptom_checkins(id) on delete set null,
  recorded_at timestamptz not null default now(),
  type text not null check (type in ('movement', 'rest', 'benadryl', 'hydration', 'other')),
  perceived_effectiveness integer check (perceived_effectiveness >= 0 and perceived_effectiveness <= 10),
  source text default 'manual' check (source in ('manual', 'benadryl_gcal')),
  notes text
);

-- Indexes
create index idx_symptom_checkins_event_id on symptom_checkins(event_id);
create index idx_symptom_checkins_recorded_at on symptom_checkins(recorded_at);
create index idx_interventions_event_id on interventions(event_id);
create index idx_pressure_events_event_start on pressure_events(event_start);
create index idx_pressure_events_status on pressure_events(status);

-- Analysis view
create view event_outcomes as
select
  pe.id,
  pe.event_start,
  pe.direction,
  pe.forecasted_change_mbar,
  pe.forecasted_duration_hrs,
  pe.rate_mbar_hr,
  max(sc.severity) as peak_severity,
  round(avg(sc.severity)::numeric, 2) as avg_severity,
  count(sc.id) as checkin_count,
  extract(epoch from (pe.first_intervention_at - pe.event_start))/3600 as hours_to_first_intervention
from pressure_events pe
left join symptom_checkins sc on sc.event_id = pe.id
group by pe.id;
