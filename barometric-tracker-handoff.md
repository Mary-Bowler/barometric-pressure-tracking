# Barometric Symptom Tracker — Deployment Handoff

## What This Is

A personal PWA (Progressive Web App) that tracks barometric pressure events, symptoms, and interventions to identify individual pressure sensitivity thresholds over time. Built specifically for Mom's situation — AuDHD, mobile-first, low cognitive load during bad episodes.

**Core question it's trying to answer:** Is her migraine response driven by total magnitude of pressure change, rate of change (mbar/hr), direction (rising vs. falling), or some combination?

**GitHub repo:** https://github.com/Mary-Bowler/barometric-pressure-tracking

---

## What's Already Done

- ✅ Full application built — 40 files, passes TypeScript type-check
- ✅ Pushed to GitHub
- ✅ `CRON_SECRET` and `BENADRYL_WEBHOOK_SECRET` generated (32-byte hex — Mom has these stored separately, ask her)
- ✅ `SETUP.md` in the repo with full deployment instructions
- ✅ Supabase project created, migration run, RLS enabled

The app just needs to be deployed. Nothing needs to be coded.

---

## What Needs to Happen (In Order)

### ✅ Step 1 — Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free account (or log in)
2. Create a new project — name it anything (e.g. `barometric-tracker`)
3. Once the project is ready, go to **Project Settings → API**
4. Copy these three values — you'll need them for Vercel:
   - `SUPABASE_URL` — the Project URL
   - `SUPABASE_ANON_KEY` — the `anon` / `public` key
   - `SUPABASE_SERVICE_ROLE_KEY` — the `service_role` key (keep this secret)
5. Go to **SQL Editor** and run the contents of `supabase/migrations/001_initial.sql` from the repo
   - This creates all the tables and the `event_outcomes` analysis view

---

### Step 2 — Create a Slack Incoming Webhook

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App → From scratch**
2. Name it (e.g. `Migraine Tracker`) and choose Mom's personal Slack workspace
3. Go to **Incoming Webhooks** → toggle **Activate Incoming Webhooks** on
4. Click **Add New Webhook to Workspace** → select the `#migraine-symptom` channel
5. Copy the webhook URL — it looks like `https://hooks.slack.com/services/T.../B.../...`
   - This becomes `SLACK_WEBHOOK_URL` in Vercel

---

### Step 3 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and create an account (or log in)
2. Click **Add New → Project** → import from GitHub → select `barometric-pressure-tracking`
3. Before deploying, go to **Environment Variables** and add all 7:

| Variable | Where to get it |
|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API |
| `SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API |
| `SLACK_WEBHOOK_URL` | Slack app you just created |
| `CRON_SECRET` | Ask Mom — already generated |
| `BENADRYL_WEBHOOK_SECRET` | Ask Mom — already generated |
| `NEXT_PUBLIC_APP_URL` | Set this AFTER first deploy — it's the Vercel URL (e.g. `https://barometric-pressure-tracking.vercel.app`) |

4. Click **Deploy** — let the first build run
5. Once deployed, copy the live URL and add it as `NEXT_PUBLIC_APP_URL`, then trigger a redeploy

---

### Step 4 — Connect Slack to the App

1. Open the deployed app in browser
2. Go to **Settings**
3. Paste the Slack webhook URL
4. Hit **Test** — a test notification should appear in `#migraine-symptom`

---

### Step 5 — Set Up Zapier (Benadryl Sync)

Mom already logs Benadryl via a Google Form → Google Calendar. This step connects that calendar to the app so it doesn't have to be re-entered.

1. Go to [zapier.com](https://zapier.com) — use Mom's account
2. Create a new Zap:
   - **Trigger:** Google Calendar → Event Created (filter to the Benadryl calendar)
   - **Action:** Webhooks by Zapier → POST
   - **URL:** `https://[your-vercel-url]/api/webhooks/benadryl`
   - **Headers:** `x-webhook-secret: [BENADRYL_WEBHOOK_SECRET]`
3. Test and turn on the Zap

---

### Step 6 — Install the PWA on Mom's iPhone

1. Open the Vercel URL in **Safari** on Mom's iPhone
2. Tap the **Share** button → **Add to Home Screen**
3. It will install like a regular app icon

---

### Step 7 — Log the First Episode Retroactively

Once everything is running, Mom has notes from a migraine episode in the `#migraine-symptom` Slack channel from March 2026. She'll want to:
1. Create a new event with the past start time
2. Add check-ins from her Slack notes

---

## Key Files in the Repo

| File | What It Does |
|---|---|
| `SETUP.md` | Full step-by-step deployment guide (more technical detail than this doc) |
| `lib/openmeteo.ts` | Fetches pressure data + detects events |
| `lib/slack.ts` | Sends Slack notifications with deep-link button |
| `lib/suggestions.ts` | Suggests interventions based on past effectiveness |
| `app/checkin/page.tsx` | 3-step check-in: severity → symptoms → intervention |
| `app/api/cron/check-pressure/route.ts` | Runs every 3 hours, detects events, fires notifications |
| `app/api/webhooks/benadryl/route.ts` | Receives Zapier webhook for Benadryl sync |
| `supabase/migrations/001_initial.sql` | Full database schema |

---

## Important Notes

- **Location is set to Kingston, OK** (34.2334, -96.7167) — configurable in app Settings after deploy
- **Alert threshold** defaults to 6 mbar over 3 hours — also configurable
- **Missed check-ins are fine** — the app won't break if she can't interact during a bad episode; retroactive entry is always available
- **Benadryl is handled separately via Zapier** — don't add a Benadryl option to the intervention UI

---

## For Zeph — Collaborator Onboarding

Mom has invited you to the Supabase organization. Here's what you need to know to contribute.

### Supabase Access

1. Accept the organization invite from Supabase (check your email)
2. Open the `barometric-tracker` project
3. Go to **Project Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` *(keep this secret — never commit it)*
4. The schema is already deployed — do **not** re-run `001_initial.sql` or you'll get errors on existing tables

### GitHub Access

The repo is at: https://github.com/Mary-Bowler/barometric-pressure-tracking

Ask Mom to add you as a collaborator (**Settings → Collaborators → Add people**) if not already done.

### Running Locally

```bash
git clone https://github.com/Mary-Bowler/barometric-pressure-tracking
cd barometric-pressure-tracking
npm install
```

Create a `.env.local` file in the project root (never commit this):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SLACK_WEBHOOK_URL=...
CRON_SECRET=...
BENADRYL_WEBHOOK_SECRET=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Then:

```bash
npm run dev
```

App runs at `http://localhost:3000`.

### Key Things to Know

- **No auth system** — this is a single-user personal app. RLS is enabled but policies are permissive for the anon key (it's not a public app, just a personal PWA)
- **Cron job** runs every 3 hours on Vercel automatically — to test it locally, hit `GET /api/cron/check-pressure` with the header `Authorization: Bearer [CRON_SECRET]`
- **Benadryl sync** comes in via Zapier webhook, not the UI — don't add Benadryl to the intervention UI
- **Location defaults** to Kingston, OK — configurable in app Settings after deploy
- The `event_outcomes` view in Supabase is the basis for the analysis charts — query it directly for ad-hoc data exploration

### Architecture Diagram

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for a Mermaid diagram of the full system workflow.

---

## Questions?

The app was designed and built by Mom in a single session (impressively, during an active migraine). She knows it deeply — ask her anything you're not sure about.
