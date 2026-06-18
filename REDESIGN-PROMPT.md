# Opus Prompt — Barometric Tracker Multi-User Redesign

---

## Your Task

You are a senior software architect. Produce a **complete, file-by-file implementation plan** to redesign the barometric pressure tracking app described below. The plan should be detailed enough that a developer can execute it without making architecture decisions — every schema change, every file to add/remove/modify, and every new dependency should be specified.

---

## What the App Does Today

A personal PWA built in Next.js 14 (TypeScript) + Supabase (PostgreSQL) + Tailwind, deployed on Vercel. It:

- Runs a Vercel cron job every 3 hours that calls the Open-Meteo API to detect barometric pressure events for a single hardcoded location (Kingston, OK)
- Sends a Slack notification with a deep-link check-in button when an event exceeds threshold
- Lets the user log symptoms (severity 0–10, symptom types) and interventions (movement, rest, benadryl, hydration, other) via a 3-step PWA check-in flow
- Syncs Benadryl doses from Google Calendar via a Zapier webhook
- Shows correlation charts via an `event_outcomes` view

**Current limitations:**
- Single-user only (no auth, global anon Supabase key, one hardcoded location)
- Slack is the only notification mechanism and the only way to be alerted of events
- Benadryl sync requires Zapier + Google Calendar setup
- RLS is enabled but no policies exist yet (tables are accessible to anon key)

---

## Current Database Schema

```sql
-- Global key/value config
create table settings (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);
-- seed: location_lat, location_lng, location_label, alert_threshold_mbar, alert_threshold_hours, slack_webhook_url

create table pressure_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  event_start timestamptz not null,
  event_end timestamptz,
  direction text not null check (direction in ('rising', 'falling')),
  forecasted_change_mbar numeric(6,2) not null,
  forecasted_duration_hrs numeric(6,2) not null,
  rate_mbar_hr numeric(6,4) generated always as (forecasted_change_mbar / nullif(forecasted_duration_hrs, 0)) stored,
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

create view event_outcomes as
select
  pe.id, pe.event_start, pe.direction,
  pe.forecasted_change_mbar, pe.forecasted_duration_hrs, pe.rate_mbar_hr,
  max(sc.severity) as peak_severity,
  round(avg(sc.severity)::numeric, 2) as avg_severity,
  count(sc.id) as checkin_count,
  extract(epoch from (pe.first_intervention_at - pe.event_start))/3600 as hours_to_first_intervention
from pressure_events pe
left join symptom_checkins sc on sc.event_id = pe.id
group by pe.id;
```

---

## Key Existing Files

```
app/
  api/
    cron/check-pressure/route.ts   — runs every 3h, detects events, fires Slack notification
    webhooks/benadryl/route.ts     — Zapier webhook receiver
  checkin/page.tsx                 — 3-step check-in UI
  settings/page.tsx                — location, threshold, Slack URL config
  analysis/page.tsx                — correlation charts (Recharts, queries event_outcomes)
lib/
  supabase.ts                      — Supabase client (anon + service role)
  openmeteo.ts                     — fetches pressure forecast, detects events
  slack.ts                         — sends Slack notification with deep-link button
  suggestions.ts                   — recommends interventions based on past effectiveness
  types.ts                         — TypeScript interfaces
vercel.json                        — cron schedule definition
supabase/migrations/001_initial.sql
```

---

## What Needs to Change

### 1. Multi-User Auth (Supabase Auth — Magic Link)

- Enable Supabase Auth with magic link (email OTP) — no passwords, no OAuth
- Every user gets their own isolated data — Mary and Zeph are the initial two users, but the system should support any number
- Add a `profiles` table (linked to `auth.users`) to store display name and any user-level metadata
- Add `user_id uuid references auth.users(id)` to `pressure_events`, `symptom_checkins`, and `interventions`
- The `settings` table needs to become per-user (replace the global key/value table with a `user_settings` table that has one row per user with typed columns)
- Write RLS policies so each authenticated user can only read/write their own rows across all tables
- The service role key (used by the cron and webhook API routes) bypasses RLS — this is correct and should stay

### 2. Per-User Location & Settings

- `user_settings` table (replaces `settings`) should include: `location_lat`, `location_lng`, `location_label`, `alert_threshold_mbar`, `alert_threshold_hours`
- Remove `slack_webhook_url` from settings entirely
- The cron job must now iterate over all users' settings and run the pressure check for each unique location
- If two users share a location, the Open-Meteo call can be deduplicated (nice-to-have, not required)

### 3. Remove Slack — Replace with PWA Push Notifications

- Remove `lib/slack.ts` entirely
- Remove the Slack notification call from the cron job
- Remove `SLACK_WEBHOOK_URL` env var
- Implement Web Push notifications (VAPID):
  - Generate VAPID public/private key pair (new env vars: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`)
  - Add a `push_subscriptions` table: `id`, `user_id`, `endpoint`, `p256dh`, `auth`, `created_at` — with RLS so users manage only their own subscriptions
  - Add a service worker (`public/sw.js`) that handles `push` events and shows a notification with a deep link to the check-in page
  - Add a `POST /api/push/subscribe` route to save/update the user's push subscription
  - Update the cron job to send a push notification to all of a user's subscriptions when their pressure event is detected
  - The Settings page should have a "Enable notifications" button that requests push permission and registers the subscription
  - Use the `web-push` npm package server-side

### 4. Remove Zapier / Benadryl Webhook — Replace with In-App Medication Logging

- Remove `app/api/webhooks/benadryl/route.ts`
- Remove `BENADRYL_WEBHOOK_SECRET` env var
- Update the `interventions.type` enum to: `'movement'`, `'rest'`, `'benadryl'`, `'triptan'`, `'ubrelvy'`, `'hydration'`, `'other'`
- Remove the `source` column's `'benadryl_gcal'` option (simplify to just `'manual'`)
- Update the check-in UI to show all medication options with friendly labels:
  - Benadryl
  - Triptan (generic — covers Sumatriptan, Rizatriptan, etc.)
  - Ubrelvy
  - Hydration
  - Movement
  - Rest
  - Other
- Update `lib/suggestions.ts` to include the new medication types in effectiveness scoring
- Update `entry_method` on `symptom_checkins` — remove `'slack'`, keep `'pwa'`

### 5. Auth UI

- Add a `/login` page with a magic link email form
- Add auth middleware (Next.js `middleware.ts`) to redirect unauthenticated users to `/login`
- Add a sign-out button to the app header/nav
- The app should feel seamless — after clicking the magic link, the user lands on the home screen already authenticated
- Use Supabase's `@supabase/ssr` package for server-side session handling in Next.js App Router

### 6. Migration SQL

Produce a `supabase/migrations/002_multi_user.sql` that:
- Adds `user_id` columns to existing tables (nullable first, then backfill if needed, then NOT NULL)
- Creates `profiles`, `user_settings`, and `push_subscriptions` tables
- Drops the old `settings` table (after migrating seed data structure)
- Updates the `interventions.type` check constraint to include new medication types
- Removes the `benadryl_gcal` source option
- Writes all RLS policies
- Updates the `event_outcomes` view to include `user_id` in the GROUP BY so it respects user isolation
- Drops `entry_method`'s `'slack'` option

---

## Constraints & Preferences

- **Keep Next.js 14 App Router + Supabase + Vercel** — do not change the core stack
- **TypeScript throughout** — update `lib/types.ts` to reflect all schema changes
- **Mobile-first** — both users are primarily on iPhone; keep the 3-step check-in flow low-friction
- **No analytics, no admin dashboard** — this is a personal health tool, not a SaaS product
- **No social features** — users cannot see each other's data under any circumstance
- **The cron job runs globally** — it serves all users from one Vercel deployment; do not create per-user cron jobs
- **Graceful push failure** — if a push notification fails (expired subscription), log it and continue; never block the cron job

---

## Deliverable Format

Produce the plan as a structured document with these sections:

1. **New dependencies** — npm packages to add (with versions if relevant)
2. **New environment variables** — what to add, where each value comes from
3. **Database migration** — complete `002_multi_user.sql` with all DDL, constraints, and RLS policies
4. **Files to delete** — list with reason
5. **Files to create** — path, purpose, and full implementation for each
6. **Files to modify** — path, what changes, and the specific diffs or rewritten sections
7. **Deployment steps** — ordered checklist for applying the migration and redeploying without breaking the existing single-user data (Mary's data should be preserved and attributed to her user account)
8. **Open questions** — anything ambiguous that should be decided before implementation begins

Be exhaustive. Omit nothing that a developer would need to look up or decide themselves.
