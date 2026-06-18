# Setup Guide

## 1. Supabase

### Create the project
1. Go to [supabase.com](https://supabase.com) → **New project**
2. Once ready, go to **Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` *(never commit this)*

### Enable Auth
1. Go to **Auth → Providers → Email** → toggle **Enable Email Provider** on
2. Make sure **Confirm email** is off (magic link flow — no separate confirmation step)
3. Go to **Auth → URL Configuration**:
   - **Site URL:** your Vercel URL (e.g. `https://pressure-tracker.vercel.app`)
   - **Redirect URLs:** add `https://pressure-tracker.vercel.app/auth/callback`
   - *(For local dev, also add `http://localhost:3000/auth/callback`)*

### Apply the schema
In **SQL Editor**, paste and run `supabase/migrations/001_initial.sql`.

If you're resetting an existing project that had the old v1 schema, drop the old
objects first:
```sql
drop view if exists event_outcomes;
drop table if exists interventions, symptom_checkins, pressure_events, settings cascade;
```
Then run `001_initial.sql`.

---

## 2. Generate VAPID Keys (Web Push)

Run once locally — save the output, you'll need it in step 4:

```bash
npx web-push generate-vapid-keys
```

This prints a **public key** and a **private key**. The public key goes in two env vars
(one client-facing, one server-side); the private key is server-only.

---

## 3. Generate CRON_SECRET

Any random string works:
```bash
openssl rand -hex 32
```

---

## 4. Deploy to Vercel

1. Push the repo to GitHub (if not already there)
2. Go to [vercel.com](https://vercel.com) → **Add New → Project** → import the repo
3. Under **Settings → Environment Variables**, add:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | From step 1 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | From step 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | From step 1 |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Public key from step 2 |
| `VAPID_PRIVATE_KEY` | Private key from step 2 |
| `VAPID_SUBJECT` | `mailto:mary.bowler@gmail.com` |
| `NEXT_PUBLIC_SITE_URL` | Your Vercel URL (e.g. `https://pressure-tracker.vercel.app`) |
| `CRON_SECRET` | From step 3 |

4. Click **Deploy**. Vercel picks up the cron schedule from `vercel.json` automatically.

---

## 5. First Sign-In

1. Open the deployed app — you'll be redirected to `/login`
2. Enter your email address and tap **Send magic link**
3. Click the link in the email → you land on the home screen, authenticated
4. A `profiles` row is auto-created by the database trigger on first login

Repeat for any additional users (Zeph, etc.) — they sign in the same way and get their
own fully isolated data.

---

## 6. Configure Your Settings

1. Go to **Settings** in the app
2. Set your location (lat/lng) and alert thresholds
3. Mary's defaults: Kingston, OK — 34.2334 lat, -96.7167 lng, 6 mbar / 3 hrs

---

## 7. Enable Push Notifications

1. **On iPhone:** open the app URL in Safari → Share → **Add to Home Screen** first
   (iOS requires the PWA to be installed before push notifications work)
2. Open the installed app from the Home Screen
3. Go to **Settings → Enable notifications** → grant permission
4. A row appears in `push_subscriptions` — you're subscribed

Test a notification manually:
```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-app.vercel.app/api/cron/check-pressure
```

---

## 8. Local Development

```bash
npm install
```

Create `.env.local` (never commit this):
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:mary.bowler@gmail.com
NEXT_PUBLIC_SITE_URL=http://localhost:3000
CRON_SECRET=
```

```bash
npm run dev
```

App runs at `http://localhost:3000`. Trigger the cron manually:
```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/check-pressure
```

Push notifications require HTTPS, so they won't work fully on localhost. Test the
subscription save via the Settings button and confirm the row appears in Supabase.
