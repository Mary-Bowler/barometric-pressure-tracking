# Barometric Pressure App — Multi-User Redesign Implementation Plan

> Companion to [`REDESIGN-PROMPT.md`](REDESIGN-PROMPT.md). This is the file-by-file
> execution plan. Next-action tracking lives in [`barometric-tracker-handoff.md`](barometric-tracker-handoff.md).

**Target stack (unchanged):** Next.js 14 App Router · TypeScript · Supabase (Postgres + Auth) · Tailwind · Vercel
**Scope:** Single-user → multi-user with magic-link auth, per-user settings, Web Push (replacing Slack), in-app medication logging (replacing Zapier/GCal), full RLS.

---

## 1. New Dependencies

| Package | Version | Purpose |
|---|---|---|
| `@supabase/ssr` | `^0.5.2` | Cookie-based session handling in App Router (server components, route handlers, middleware). |
| `@supabase/supabase-js` | `^2.45.0` | Already present — keep / bump. Used for the service-role client. |
| `web-push` | `^3.6.7` | Server-side VAPID Web Push delivery from the cron job. |
| `@types/web-push` | `^3.6.3` (dev) | Types for `web-push`. |

```bash
npm i @supabase/ssr web-push
npm i -D @types/web-push
npm i @supabase/supabase-js@latest   # ensure >= 2.45
npx web-push generate-vapid-keys     # generate VAPID keypair (see section 2)
```

---

## 2. New Environment Variables

| Var | Scope | Source |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Existing — keep. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | Existing — keep (now drives `@supabase/ssr` authed clients). |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Existing — keep. Cron/push routes; bypasses RLS. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | client + server | From `web-push generate-vapid-keys` (public key). |
| `VAPID_PRIVATE_KEY` | server only | Same command (private key). Never expose to client. |
| `VAPID_SUBJECT` | server only | `mailto:mary.bowler@gmail.com`. |
| `NEXT_PUBLIC_SITE_URL` | client + server | e.g. `https://barometric-pressure-tracking.vercel.app` — deep links + `emailRedirectTo`. |
| `CRON_SECRET` | server only | Existing — keep. Vercel sends `Authorization: Bearer $CRON_SECRET`. |

**Remove:** `SLACK_WEBHOOK_URL`, `BENADRYL_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL` (replaced by `NEXT_PUBLIC_SITE_URL`).

Supabase dashboard (Auth → URL Configuration): set **Site URL** = `NEXT_PUBLIC_SITE_URL`, add `${SITE_URL}/auth/callback` to **Redirect URLs**.

---

## 3. Database Schema — rewrite `supabase/migrations/001_initial.sql` (clean v2)

> **No data to preserve** (the app was never used; the DB has the empty v1 tables). So we
> don't do an incremental `002` backfill — we replace `001_initial.sql` with the complete
> v2 schema and reset the empty database (see §7). No `DO` guard, no backfill, no
> drop-and-migrate: `user_id` is `NOT NULL` from the start, and users/settings are created
> naturally on first login (magic link → `handle_new_user` trigger → profile; Settings page → `user_settings`).

```sql
-- ============================================================
-- 001_initial.sql — barometric tracker, multi-user (clean v2)
-- ============================================================

-- profiles (1:1 with auth.users) — auto-created by trigger on signup
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- user_settings (per-user; replaces the old global key/value `settings` table)
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
  direction text not null check (direction in ('rising','falling')),
  forecasted_change_mbar numeric(6,2) not null,
  forecasted_duration_hrs numeric(6,2) not null,
  rate_mbar_hr numeric(6,4) generated always as (forecasted_change_mbar / nullif(forecasted_duration_hrs,0)) stored,
  first_intervention_at timestamptz,
  actual_pressure_start numeric(7,2),
  actual_pressure_end numeric(7,2),
  source text default 'auto' check (source in ('auto','manual')),
  notes text,
  status text default 'active' check (status in ('active','completed')),
  midpoint_due_at timestamptz,
  peak_due_at timestamptz,
  midpoint_notified_at timestamptz,
  peak_notified_at timestamptz
);

-- symptom_checkins (entry_method: pwa only — 'slack' removed)
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
  prompt_type text check (prompt_type in ('start','midpoint','peak','manual'))
);

-- interventions (type: +triptan,+ubrelvy; source: manual only — 'benadryl_gcal' removed)
create table interventions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  event_id uuid references pressure_events(id) on delete cascade,
  checkin_id uuid references symptom_checkins(id) on delete set null,
  recorded_at timestamptz not null default now(),
  type text not null check (type in ('movement','rest','benadryl','triptan','ubrelvy','hydration','other')),
  perceived_effectiveness integer check (perceived_effectiveness >= 0 and perceived_effectiveness <= 10),
  source text default 'manual' check (source in ('manual')),
  notes text
);

-- push_subscriptions (Web Push / VAPID)
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index pressure_events_user_idx    on pressure_events(user_id);
create index symptom_checkins_user_idx   on symptom_checkins(user_id);
create index interventions_user_idx      on interventions(user_id);
create index push_subscriptions_user_idx on push_subscriptions(user_id);

-- event_outcomes view (security_invoker so it respects the caller's RLS)
create view event_outcomes with (security_invoker = true) as
select pe.user_id, pe.id, pe.event_start, pe.direction,
  pe.forecasted_change_mbar, pe.forecasted_duration_hrs, pe.rate_mbar_hr,
  max(sc.severity) as peak_severity,
  round(avg(sc.severity)::numeric, 2) as avg_severity,
  count(sc.id) as checkin_count,
  extract(epoch from (pe.first_intervention_at - pe.event_start))/3600 as hours_to_first_intervention
from pressure_events pe
left join symptom_checkins sc on sc.event_id = pe.id
group by pe.user_id, pe.id;

-- Row Level Security
alter table profiles           enable row level security;
alter table user_settings      enable row level security;
alter table push_subscriptions enable row level security;
alter table pressure_events    enable row level security;
alter table symptom_checkins   enable row level security;
alter table interventions      enable row level security;

create policy profiles_select on profiles for select using (auth.uid() = id);
create policy profiles_update on profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy profiles_insert on profiles for insert with check (auth.uid() = id);

create policy us_all on user_settings      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy ps_all on push_subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy pe_all on pressure_events    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy sc_all on symptom_checkins   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy iv_all on interventions      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Service role bypasses RLS, so cron/push routes keep cross-user access with no policy.
```

`security_invoker = true` makes the view respect the querying user's RLS instead of the
owner's (otherwise `event_outcomes` would leak all users' data). `GROUP BY pe.user_id` is belt-and-suspenders.

> If you'd rather split for-the-record `for all` policies into per-command (select/insert/update/delete)
> policies, expand each `*_all` policy accordingly — same `auth.uid() = user_id` predicate.

---

## 4. Files to Delete

| File | Reason |
|---|---|
| `lib/slack.ts` | Slack removed; replaced by Web Push. |
| `app/api/webhooks/benadryl/route.ts` | Zapier/GCal benadryl sync removed; meds logged in-app. Remove empty `app/api/webhooks/` dir. |

`supabase/migrations/001_initial.sql` is **rewritten** to the clean v2 schema (§3) — not kept as-is. No `002` migration is created.

---

## 5. Files to Create

| Path | Purpose |
|---|---|
| `lib/supabase/server.ts` | Per-request server client (`createServerClient` + `next/headers` cookies). |
| `lib/supabase/client.ts` | Browser client (`createBrowserClient`). |
| `lib/supabase/service.ts` | Service-role client (bypasses RLS; cron/push only). |
| `middleware.ts` | Session refresh + redirect unauthenticated users to `/login`. Matcher excludes `_next`, static, `sw.js`, `api/cron`, `api/push`. |
| `app/login/page.tsx` | Magic-link email form (`signInWithOtp`, `emailRedirectTo = ${SITE_URL}/auth/callback`). |
| `app/auth/callback/route.ts` | `exchangeCodeForSession(code)` → redirect home. |
| `app/api/push/subscribe/route.ts` | Authed route; upsert push subscription on `(user_id, endpoint)`. |
| `lib/push.ts` | `sendPushToUser(userId, payload)` — service client; prunes 404/410 subs; never throws. |
| `public/sw.js` | Service worker: `push` → `showNotification`; `notificationclick` → focus/open deep link. |
| `lib/push-client.ts` | `enablePush()` — request permission, register SW, subscribe, POST to `/api/push/subscribe`. |
| `components/SignOutButton.tsx` | Client sign-out button → `/login`. |
| `public/manifest.webmanifest` + `public/icons/*` | PWA install (required for iOS push). |

> Full implementation of each file is in the chat transcript that produced this plan.

---

## 6. Files to Modify

| Path | Change |
|---|---|
| `lib/supabase.ts` | Delete / split into the three `lib/supabase/*.ts` clients; update all imports. |
| `lib/types.ts` | Add `Profile`, `UserSettings`, `PushSubscriptionRow`; add `user_id` to `PressureEvent`/`SymptomCheckin`/`Intervention`; `InterventionType` += `triptan`,`ubrelvy`; `InterventionSource` = `'manual'`; `EntryMethod` = `'pwa'`; add `user_id` to `EventOutcome`; export `INTERVENTION_OPTIONS` (friendly labels). |
| `app/api/cron/check-pressure/route.ts` | Use service client; loop over all `user_settings` (dedupe Open-Meteo by coord); insert events with `user_id`; replace all Slack calls with `sendPushToUser`; same for midpoint/peak reminders. |
| `app/settings/page.tsx` | Load/save `user_settings` (keyed by `auth.uid()`); remove Slack webhook field; add "Enable notifications" button (`enablePush`) + iOS Home-Screen hint. |
| `app/checkin/page.tsx` | Render `INTERVENTION_OPTIONS` (Benadryl/Triptan/Ubrelvy/Hydration/Movement/Rest/Other); set `user_id` on inserts; `entry_method='pwa'`. |
| `app/analysis/page.tsx` | Add defensive `.eq('user_id', user.id)`; include new med types in per-intervention charts. |
| `lib/suggestions.ts` | Score full `InterventionType` union (add triptan/ubrelvy); drop `benadryl_gcal` special-casing; runs in authed anon context. |
| `app/layout.tsx` (or nav) | Render `<SignOutButton />` + display name. |
| `vercel.json` | Cron schedule unchanged (`0 */3 * * *`); confirm path + `CRON_SECRET`. |

---

## 7. Deployment Steps (clean — no data to preserve)

1. Land all code changes on a branch (do not deploy yet).
2. `npx web-push generate-vapid-keys`; record keys.
3. Set new env vars in Vercel (Prod + Preview) + `.env.local`; **delete** `SLACK_WEBHOOK_URL`, `BENADRYL_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`.
4. Supabase Auth: enable Email/magic-link; set Site URL + `${SITE_URL}/auth/callback` redirect; confirm SMTP.
5. **Reset the empty DB to the clean v2 schema.** The DB currently holds the empty v1 tables, so just replace them:
   - CLI: `supabase db reset` (re-applies the rewritten `001_initial.sql`), or
   - Dashboard SQL editor: drop the existing objects (`drop view if exists event_outcomes; drop table if exists interventions, symptom_checkins, pressure_events, settings cascade;`) then run the new `001_initial.sql`.
   - No user/data setup needed — accounts and settings are created on first login.
6. Deploy the branch.
7. Auth E2E: prod URL → `/login` → magic link → land authenticated (profile auto-created by the trigger). Set location/thresholds in Settings.
8. Push test per device: install PWA to iPhone Home Screen → Settings → Enable notifications → confirm `push_subscriptions` row → trigger cron (`curl -H "Authorization: Bearer $CRON_SECRET" .../api/cron/check-pressure`) → notification deep-links to `/checkin`.
9. **Delete the unused Slack incoming webhook** you created earlier (it's no longer referenced). No Zapier was ever set up, so nothing to decommission there.
10. Zeph signs in via `/login`, sets their own location/thresholds, enables notifications.

---

## 8. Open Questions

1. `detectEvents` must accept thresholds as params (not read global `settings`) — confirm/refactor.
2. Duplicate-event guard: exact `event_start` match vs. overlap-window tolerance?
3. Magic-link flow: PKCE `?code=` (assumed) vs. token-hash template (`verifyOtp`)?
4. Reminders fire only on the 3h cron (up to ~3h late) — acceptable, or tighten cron?
5. iOS push needs installed PWA — add an install-prompt banner when `navigator.standalone === false`?
6. Where is `first_intervention_at` set, and does it still work per-user?
7. Capture `display_name` on first login, or accept email-derived default?
8. Confirm `lib/suggestions.ts` runs in authed (anon-key) context, not service role.
9. Location entry: keep manual lat/lng, or add geocoding for Zeph onboarding?
10. `on delete cascade` from `auth.users` wipes a user's data on account deletion — desired?
