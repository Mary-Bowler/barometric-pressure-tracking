# Barometric Symptom Tracker

A mobile-first PWA for tracking barometric pressure events, symptoms, and interventions — built to answer the question: **is my response driven by magnitude, rate, direction, or some combination?**

Multi-user, magic-link auth. Each user gets their own location, thresholds, and fully isolated data.

## What it does

- Monitors hourly pressure forecasts for each user's location via [Open-Meteo](https://open-meteo.com/)
- Detects events where forecasted pressure change exceeds your configured threshold
- Sends a **Web Push notification** (VAPID) with a one-tap deep link to the check-in screen
- Prompts check-ins at event **start**, **midpoint**, and **expected peak**
- Tracks interventions in-app: Benadryl, Triptan, Ubrelvy, Hydration, Movement, Rest, Other
- Suggests interventions based on what has worked at similar severity levels historically
- Missed check-ins never break the record; retroactive entry is always available
- Surfaces correlations between pressure rate, magnitude, and direction over time

## Architecture

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 PWA (App Router) |
| Hosting | Vercel |
| Database | Supabase (PostgreSQL + Auth) |
| Auth | Supabase magic link (email OTP, no passwords) |
| Notifications | Web Push / VAPID → service worker deep link |
| Pressure data | Open-Meteo API (free, no key required) |
| Scheduled checks | Vercel Cron (every 3 hours, serves all users) |

## Data model

```
auth.users             Managed by Supabase Auth (magic link)
profiles               Display name; auto-created on first sign-in
user_settings          Per-user location + alert thresholds
push_subscriptions     VAPID endpoint + keys per user/device

pressure_events
  user_id, direction, forecasted_change_mbar, forecasted_duration_hrs
  rate_mbar_hr (computed), first_intervention_at, status
  midpoint_due_at, peak_due_at (for follow-up push reminders)

symptom_checkins
  user_id, event_id, severity (0–10), symptom_types[], note
  recorded_at, prompt_type (start/midpoint/peak/manual)

interventions
  user_id, event_id, checkin_id
  type (benadryl | triptan | ubrelvy | hydration | movement | rest | other)
  perceived_effectiveness (0–10), source (manual)

event_outcomes         VIEW — peak/avg severity + intervention timing per event
                         (security_invoker; each user sees only their own rows)
```

## Notification flow

```
Vercel Cron (3hr)
  └── reads user_settings for all users
        └── fetches Open-Meteo forecast (deduped by location)
              └── threshold crossed → insert pressure_event (user_id)
                    └── Web Push to all user's subscriptions
                          └── service worker shows notification
                                └── tap → /checkin?event_id=<id>&prompt=start
                                      └── severity slider + symptom chips + submit
                                            └── intervention suggestions (based on history)

Subsequent cron runs check midpoint_due_at / peak_due_at per user
and send follow-up push notifications when the time arrives.

No response → event stays open. Log retroactively from the app at any time.
```

## Intervention suggestion engine

When you reach the intervention step after a check-in:

1. Finds all past interventions linked to check-ins within ±2 severity of your current reading
2. Groups by intervention type, averages `perceived_effectiveness`
3. Returns the top 3 by average effectiveness (covers all types: Benadryl, Triptan, Ubrelvy, etc.)

## Setup

See [`SETUP.md`](./SETUP.md) for step-by-step instructions covering:

1. Supabase project creation, Auth config, and schema migration
2. VAPID key generation for Web Push
3. Vercel deployment and environment variables
4. First sign-in and per-user settings
5. Enabling push notifications per device (install to Home Screen first on iPhone)

## Environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=                   # mailto: or https: sender identifier
NEXT_PUBLIC_SITE_URL=            # your Vercel deployment URL
CRON_SECRET=                     # secures the /api/cron endpoint
```

## Configuration

All thresholds and location data are set per-user in the app's Settings screen — no redeploy needed.

| Setting | Default |
|---|---|
| Location | set on first login |
| Alert threshold | 6 mbar |
| Alert window | 3 hours |

## API reference

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/events` | List pressure events (user-scoped via RLS) |
| `POST` | `/api/events` | Create event (manual or auto) |
| `PATCH` | `/api/events` | Update event |
| `POST` | `/api/checkins` | Log a symptom check-in |
| `GET` | `/api/checkins?event_id=` | List check-ins for an event |
| `POST` | `/api/interventions` | Log an intervention |
| `PATCH` | `/api/interventions` | Update effectiveness score |
| `GET` | `/api/suggestions?severity=` | Get intervention suggestions |
| `POST` | `/api/push/subscribe` | Save a VAPID push subscription |
| `GET` | `/api/cron/check-pressure` | Pressure monitoring (Vercel Cron) |

## Development

```bash
npm install
cp .env.example .env.local
# fill in .env.local (see SETUP.md §8)
npm run dev
```

App runs at `http://localhost:3000`. Trigger the cron manually:
```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/check-pressure
```

Push notifications require HTTPS and a service worker — they won't fire over `localhost`,
but the subscription save (`/api/push/subscribe`) can be tested. Use ngrok or deploy a
preview branch to test end-to-end push.
