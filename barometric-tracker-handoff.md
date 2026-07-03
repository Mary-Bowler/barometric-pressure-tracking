# Barometric Symptom Tracker — Deployment Handoff

## What This Is

A personal PWA (Progressive Web App) that tracks barometric pressure events, symptoms, and interventions to identify individual pressure sensitivity thresholds over time. Built specifically for Mom's situation — AuDHD, mobile-first, low cognitive load during bad episodes.

**Core question it's trying to answer:** Is her migraine response driven by total magnitude of pressure change, rate of change (mbar/hr), direction (rising vs. falling), or some combination?

**GitHub repo:** https://github.com/Mary-Bowler/barometric-pressure-tracking

---

## Project Status

The original single-user app was **built but never deployed or used** — setup stalled after
creating the Slack webhook (got distracted by other work). **There is no live data.** We are
now skipping the rest of the v1 launch and going straight to the **multi-user redesign**.

**Where v1 actually got to:**
- ✅ Full application built, type-checks, pushed to GitHub
- ✅ Supabase project created, `001_initial.sql` run → **empty v1 tables** (no policies, no data)
- ✅ `CRON_SECRET` generated (Mary has it stored separately)
- ✅ Slack incoming webhook created — **now unused; delete it**
- ⬜ Never deployed to Vercel · ⬜ never installed on iPhone · ⬜ no Zapier set up · ⬜ never used

**What's decided (v2 redesign):**
- ✅ Redesign committed. Full file-by-file plan: [`REDESIGN-PLAN.md`](REDESIGN-PLAN.md)
- ✅ Prompt that produced the plan: [`REDESIGN-PROMPT.md`](REDESIGN-PROMPT.md)
- ✅ Clean single v2 schema — **rewrite `001_initial.sql`** and reset the empty DB (no `002`,
  no data backfill), since there's nothing to preserve.

The redesign replaces: Slack → Web Push (VAPID) · Zapier/GCal Benadryl → in-app meds
(adds Triptan, Ubrelvy) · single-user → multi-user magic-link auth + per-user settings + full RLS.
**Initial users:** Mary and Zeph; the system supports any number.

---

## Next Actions (In Order)

> Detailed, file-by-file steps live in [`REDESIGN-PLAN.md`](REDESIGN-PLAN.md) §7. This is the tracking checklist.

### Build ✅ complete — TypeScript passes clean
- [x] Add deps: `@supabase/ssr`, `web-push`, `@types/web-push`
- [x] Split `lib/supabase.ts` → `lib/supabase/{client,server,service}.ts`; updated all imports
- [x] Add `middleware.ts` (session refresh + `/login` redirect)
- [x] Add auth UI: `app/login/page.tsx`, `app/auth/callback/route.ts`, `components/SignOutButton.tsx` (wired into layout)
- [x] Add push: `public/sw.js`, `lib/push.ts`, `lib/push-client.ts`, `app/api/push/subscribe/route.ts`
- [x] **Deleted** `lib/slack.ts`, `lib/supabase.ts`, `app/api/webhooks/benadryl/route.ts`, `app/api/settings/test-slack/route.ts`
- [x] Rewrite `lib/types.ts` (user_id everywhere, triptan + ubrelvy, `INTERVENTION_OPTIONS`)
- [x] Rewrite `app/api/cron/check-pressure/route.ts`: loops all `user_settings`, dedupes Open-Meteo, push instead of Slack
- [x] Rewrite `app/api/settings/route.ts`: reads/writes `user_settings`, auth-gated
- [x] Update all API routes (`/api/checkins`, `/api/events`, `/api/interventions`, `/api/export`, `/api/suggestions`) — authed, user_id in inserts
- [x] Rewrite `app/settings/page.tsx` (per-user settings, push enable button, no Slack field)
- [x] Update `app/checkin/page.tsx` (7 med options via `INTERVENTION_OPTIONS`, `entry_method='pwa'`)
- [x] Update `app/page.tsx`, `app/events/page.tsx`, `app/analysis/page.tsx` — authed server client
- [x] Update `app/layout.tsx` — sign-out button in header when logged in
- [x] Update `lib/suggestions.ts` — no benadryl_gcal filter, accepts db client as param
- [x] Update `components/InterventionSuggestions.tsx` — triptan + ubrelvy labels/icons
- [x] Rewrite `supabase/migrations/001_initial.sql` — clean v2 schema

### Config & secrets
- [x] `CRON_SECRET` — generated and added to Vercel; saved in password manager as **"Cron Secret"**
- [ ] `npx web-push generate-vapid-keys` → set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- [ ] Set `NEXT_PUBLIC_SITE_URL`; **remove** `SLACK_WEBHOOK_URL`, `BENADRYL_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`
- [ ] Supabase Auth: enable Email/magic-link; set Site URL + `${SITE_URL}/auth/callback` redirect; confirm SMTP

### Schema reset & deploy (clean — no data to preserve)
- [ ] Reset the empty DB to the clean v2 schema: `supabase db reset` (re-runs the rewritten `001_initial.sql`), **or** in the SQL editor drop the v1 objects and run the new `001_initial.sql`
- [ ] Deploy the branch to Vercel; set `NEXT_PUBLIC_SITE_URL` to the live URL
- [ ] E2E: `/login` → magic link → authenticated home (profile auto-created by trigger) → set location/thresholds in Settings
- [ ] Push test per device: install PWA to Home Screen → Settings → Enable notifications → trigger cron → notification deep-links to `/checkin`
- [ ] **Delete the unused Slack incoming webhook** (no Zapier was ever set up)
- [ ] Zeph onboards: `/login`, set own location/thresholds, enable notifications

### Docs
- [x] Update `ARCHITECTURE.md`, `SETUP.md`, `README.md` to match v2 design

---

## Open Questions (decide before/while building)

See [`REDESIGN-PLAN.md`](REDESIGN-PLAN.md) §8 for the full list. The ones that block the build:
1. Does `detectEvents` take thresholds as params, or read the (now-removed) global `settings`? Refactor if the latter.
2. Magic-link flow — PKCE `?code=` (plan assumes this) vs. token-hash email template?
3. Duplicate-event guard — exact `event_start` match vs. overlap-window tolerance per user?

---

## Key Files in the Repo

| File | What It Does |
|---|---|
| `REDESIGN-PLAN.md` | File-by-file implementation plan for the multi-user redesign |
| `SETUP.md` | Deployment guide (⚠️ describes v1 — update for redesign) |
| `lib/openmeteo.ts` | Fetches pressure data + detects events |
| `lib/push.ts` | Sends Web Push notifications with deep link (replaces `lib/slack.ts`) |
| `lib/suggestions.ts` | Suggests interventions based on past effectiveness |
| `app/checkin/page.tsx` | 3-step check-in: severity → symptoms → intervention |
| `app/api/cron/check-pressure/route.ts` | Runs every 3 hours for all users, detects events, fires push |
| `app/api/push/subscribe/route.ts` | Saves a user's push subscription (replaces the Benadryl webhook) |
| `supabase/migrations/001_initial.sql` | Schema — **rewritten** to clean v2 (auth, RLS, push, meds); reset the empty DB to apply |

---

## Important Notes

- **Per-user location** — each user sets their own location/thresholds in Settings (was a single hardcoded global). Mary's migrates to Kingston, OK (34.2334, -96.7167) at 6 mbar / 3 hrs.
- **Missed check-ins are fine** — the app won't break if she can't interact during a bad episode; retroactive entry is always available
- **Meds are logged in-app now** (not via Zapier). The intervention UI shows all options: Benadryl, Triptan, Ubrelvy, Hydration, Movement, Rest, Other.
- **Notifications are Web Push** (VAPID), not Slack. On iPhone, the PWA must be added to the Home Screen *before* enabling notifications.
- **Data is isolated per user via RLS** — no user can ever see another's data. The cron/webhook routes use the service-role key, which bypasses RLS (intended).

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
4. **Schema (v2 reset required):** the project DB currently holds the *empty v1* tables. For v2 you must reset first — drop the v1 objects, then run the **rewritten** `001_initial.sql` (see `DEPLOY-RUNBOOK.md` Phase 2b, or `supabase db reset` on a linked project). ⚠️ The v2 `001_initial.sql` has **no `DROP` statements**, so running it over the existing v1 tables without dropping them first will collide on `pressure_events`, `symptom_checkins`, `interventions`, and `event_outcomes`.
   *(This step previously read "schema already deployed — do not re-run 001." That described v1 and is now obsolete — the v2 schema is a full rewrite that has not been applied.)*

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
CRON_SECRET=...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:mary.bowler@gmail.com
```

Then:

```bash
npm run dev
```

App runs at `http://localhost:3000`.

### Key Things to Know

- **Auth is Supabase magic-link** (email OTP, no passwords/OAuth) via `@supabase/ssr`. Every user gets isolated data enforced by RLS policies (`auth.uid() = user_id`).
- **Cron job** runs every 3 hours on Vercel — it now iterates over *all* users' settings. To test locally, hit `GET /api/cron/check-pressure` with `Authorization: Bearer [CRON_SECRET]`.
- **Meds are logged in the check-in UI** (Benadryl, Triptan, Ubrelvy, Hydration, Movement, Rest, Other) — no Zapier/Google Calendar.
- **Notifications are Web Push** (VAPID) — users enable them per-device from Settings; subscriptions live in `push_subscriptions`.
- **Per-user location/thresholds** live in `user_settings` (replaces the old global `settings` table).
- The `event_outcomes` view (now `security_invoker`, includes `user_id`) is the basis for the analysis charts — query it directly for ad-hoc exploration (returns only your own rows).

### Architecture Diagram

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for a Mermaid diagram of the full system workflow.

---

## Questions?

The app was designed and built by Mom in a single session (impressively, during an active migraine). She knows it deeply — ask her anything you're not sure about.
