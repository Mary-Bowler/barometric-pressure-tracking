# Barometric Symptom Tracker

A mobile-first PWA for tracking barometric pressure events, symptoms, and interventions — built to answer the question: **is my response driven by magnitude, rate, direction, or some combination?**

## What it does

- Monitors hourly pressure forecasts for your location via [Open-Meteo](https://open-meteo.com/)
- Detects events where forecasted pressure change exceeds your configured threshold
- Sends a Slack notification with a one-tap link to log how you're feeling
- Prompts check-ins at event **start**, **midpoint**, and **expected peak**
- Suggests interventions based on what has worked at similar severity levels historically
- Pulls Benadryl intake automatically from Google Calendar — no double-logging
- Missed check-ins never break the record; retroactive entry is always available
- Surfaces correlations between pressure rate, magnitude, and direction over time
- Exports all data as CSV for deeper analysis

## Architecture

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 PWA (App Router) |
| Hosting | Vercel |
| Database | Supabase (PostgreSQL) |
| Notifications | Slack Incoming Webhook → deep link to PWA |
| Pressure data | Open-Meteo API (free, no key required) |
| Benadryl sync | Zapier: Google Calendar → `/api/webhooks/benadryl` |
| Scheduled checks | Vercel Cron (every 3 hours) |

Slack was chosen over SMS because the app is installed as a PWA — a Slack notification with a "Log Check-in" button opens directly to the pre-loaded check-in screen, which is faster than parsing a typed SMS reply and keeps all data entry in an interface designed for low cognitive load.

## Data model

```
pressure_events
  direction, forecasted_change_mbar, forecasted_duration_hrs
  rate_mbar_hr (computed), first_intervention_at, status

symptom_checkins
  event_id, severity (0–10), symptom_types[], note
  recorded_at, prompt_type (start/midpoint/peak/manual)

interventions
  event_id, checkin_id, type, perceived_effectiveness (0–10)
  source (manual | benadryl_gcal)

settings
  location, alert thresholds, slack_webhook_url
```

## Notification flow

```
Vercel Cron (3hr) → Open-Meteo forecast
  └── threshold crossed → insert pressure_event
        └── Slack DM: "Pressure dropping 8 mbar — Log Check-in [button]"
              └── tap → /checkin?event_id=xxx&prompt=start
                    └── severity slider + symptom chips + submit
                          └── intervention suggestions (based on history)

Subsequent cron runs check midpoint_due_at / peak_due_at
and send follow-up notifications when the time arrives.

No response → event stays open. Log retroactively from the app at any time.
```

## Intervention suggestion engine

When you reach the intervention step after a check-in:

1. Finds all past interventions linked to check-ins within ±2 severity of your current reading
2. Excludes Benadryl entries synced from Google Calendar (shown separately)
3. Groups by intervention type, averages `perceived_effectiveness`
4. Returns the top 3 by average effectiveness

## Setup

See [`SETUP.md`](./SETUP.md) for step-by-step instructions covering:

1. Supabase project creation and schema migration
2. Slack incoming webhook for your workspace
3. Vercel deployment and environment variables
4. Zapier Zap for Benadryl calendar sync
5. PWA installation on iPhone (Safari → Share → Add to Home Screen)
6. Retroactive entry for past episodes

## Environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SLACK_WEBHOOK_URL=           # fallback; preferred to set via Settings UI
CRON_SECRET=                 # secures the /api/cron endpoint
BENADRYL_WEBHOOK_SECRET=     # validates Zapier webhook calls
NEXT_PUBLIC_APP_URL=         # your Vercel deployment URL
```

## Configuration

All thresholds and location data are editable in the app's Settings screen without redeploying.

| Setting | Default |
|---|---|
| Location | Kingston, OK (34.2334, -96.7167) |
| Alert threshold | 6 mbar |
| Alert window | 3 hours |

## API reference

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/events` | List pressure events |
| `POST` | `/api/events` | Create event (manual or auto) |
| `PATCH` | `/api/events` | Update event |
| `POST` | `/api/checkins` | Log a symptom check-in |
| `GET` | `/api/checkins?event_id=` | List check-ins for an event |
| `POST` | `/api/interventions` | Log an intervention |
| `PATCH` | `/api/interventions` | Update effectiveness score |
| `GET` | `/api/suggestions?severity=` | Get intervention suggestions |
| `GET` | `/api/export` | Download CSV (optional `?start=&end=`) |
| `GET/POST` | `/api/settings` | Read / update settings |
| `POST` | `/api/settings/test-slack` | Send a test Slack message |
| `POST` | `/api/webhooks/benadryl` | Zapier endpoint for calendar sync |
| `GET` | `/api/cron/check-pressure` | Pressure monitoring (Vercel Cron) |

## Development

```bash
npm install
cp .env.example .env.local
# fill in .env.local with your Supabase and Slack credentials
npm run dev
```

The app runs at `http://localhost:3000`. The cron endpoint can be triggered manually at `/api/cron/check-pressure` with the `Authorization: Bearer <CRON_SECRET>` header.
