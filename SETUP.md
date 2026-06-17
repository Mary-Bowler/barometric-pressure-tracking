# Setup Guide

## ✅ 1. Supabase

1. ✅ Go to [supabase.com](https://supabase.com) → New project
2. ✅ Once created, open **SQL Editor**
3. ✅ Paste and run the contents of `supabase/migrations/001_initial.sql`
4. ✅ Go to **Settings → API**
   - Copy **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - Copy **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Copy **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

## 2. Slack Webhook

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App → From scratch**
2. Name it "Pressure Tracker", pick your personal workspace
3. Under **Add features and functionality** → **Incoming Webhooks** → toggle On
4. Click **Add New Webhook to Workspace**
5. Select the `#migraine-symptom` channel (or whichever channel you prefer)
6. Copy the webhook URL → `SLACK_WEBHOOK_URL`

## 3. Generate Secrets

Generate two random strings (e.g., run `openssl rand -hex 32` twice, or use any password generator):
- One for `CRON_SECRET`
- One for `BENADRYL_WEBHOOK_SECRET`

## 4. Deploy to Vercel

1. Push this project to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → Import Repository
3. Add all environment variables under **Settings → Environment Variables**:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SLACK_WEBHOOK_URL
CRON_SECRET
BENADRYL_WEBHOOK_SECRET
NEXT_PUBLIC_APP_URL        ← set to your Vercel URL, e.g. https://pressure-tracker.vercel.app
```

4. Deploy. Vercel will automatically pick up the cron schedule from `vercel.json`.

## 5. Configure the App

1. Open the deployed app → **Settings** tab
2. Confirm your location, thresholds, and paste in the Slack webhook URL if not set via env var
3. Tap **Test** next to the Slack URL to confirm a message arrives in your channel

## 6. Zapier — Benadryl Sync

Create a new Zap:

**Trigger:** Google Calendar → Event Created
- Calendar: the one your Benadryl entries go to
- Filter: only when event title contains "Benadryl" (add a Filter step)

**Action:** Webhooks by Zapier → POST
- URL: `https://your-app.vercel.app/api/webhooks/benadryl`
- Payload type: JSON
- Data:
  ```
  gcal_event_id  →  Event ID
  timestamp      →  Start Date & Time
  title          →  Summary/Title
  ```
- Headers:
  ```
  x-webhook-secret  →  your BENADRYL_WEBHOOK_SECRET value
  ```

## 7. Install as PWA (iPhone)

1. Open the app URL in Safari
2. Tap the Share button → **Add to Home Screen**
3. The app will behave like a native app with no browser chrome

## 8. Log Today's Episode (Retroactive)

1. Tap **New Event** from the home screen
2. Set the start time to when your migraine began today (2026-03-15)
3. Enter your best estimate of the pressure change and duration
4. After creating the event, use **Log Check-in** to add your symptom progression from the notes in #migraine-symptom
