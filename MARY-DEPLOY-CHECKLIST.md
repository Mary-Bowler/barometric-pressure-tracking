# MARY-DEPLOY-CHECKLIST — Barometric Symptom Tracker v2

**The account-side deploy, start to finish.** This is the thing to follow while deploying.
It is self-contained; the fuller narrative lives in `../DEPLOY-RUNBOOK.md` (Zeph's copy) and
`barometric-tracker-handoff.md`, but you don't need them to complete this.

**Legend:** 👤 = you (dashboard / email / phone) · 💻 = a terminal command · 🔒 = secret (never commit / never `NEXT_PUBLIC_`).

> ### What Zeph's session already did (branch `handoff/v2-deploy-prep`)
> - Verified `npm run build` is clean at tip `eaa98a8` (18/18 routes).
> - **Created the PWA icons** — they were missing and would have blocked the iPhone install.
> - Made the migration re-runnable; hardened the push + API routes.
>
> So the **code is ready**. Everything below touches *your accounts* (Supabase, Vercel, GitHub, Slack).

---

## ⚠️ The two things most likely to trip you up

1. **Cron needs Vercel Pro.** The schedule is `0 */3 * * *` (every 3h = 8×/day). **Vercel Hobby
   caps cron at once per day**, so on Hobby the job silently won't fire on schedule. → Either upgrade
   to **Pro**, or keep Hobby and run the schedule from **Supabase `pg_cron`** (Appendix B) and delete
   the `crons` block from `vercel.json`.
2. **`NEXT_PUBLIC_SITE_URL` is baked in at build time.** It's compiled into the login magic-link
   redirect *and* the push deep-links. If it isn't set to the real URL **before** the build you
   promote, both break. → Set it, then **redeploy** (Step 4c).

---

## 0. Prereqs 👤
- [ ] You can log into **Supabase**, **Vercel**, and the **GitHub repo** (`Mary-Bowler/barometric-pressure-tracking`).
- [ ] You have the existing **`CRON_SECRET`** (saved in your password manager as "Cron Secret").
- [ ] The `handoff/v2-deploy-prep` branch is merged to `main` (or you deploy that branch).

## 1. Generate VAPID keys 💻
```bash
npx web-push generate-vapid-keys
```
Keep the **Public Key** → `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and **Private Key** 🔒 → `VAPID_PRIVATE_KEY`.

## 2. Supabase 👤

**2a. Auth** (Authentication → Providers / URL Configuration)
- [ ] Enable **Email** provider (magic link / OTP). No passwords.
- [ ] **Site URL** = your production URL (fill in after Step 4 once you know it — circle back).
- [ ] Add **Redirect URL**: `https://<your-app>.vercel.app/auth/callback`
- [ ] Confirm SMTP works (default Supabase SMTP is fine for 2 users).

**2b. Schema reset** (SQL Editor) — the DB holds *empty v1* tables; there is **no data to preserve**.
The v2 `001_initial.sql` has **no DROP statements**, so drop the v1 objects first, then paste the
**full** contents of `supabase/migrations/001_initial.sql` and run it:
```sql
-- drop v1 objects (all empty)
drop view  if exists event_outcomes;
drop table if exists interventions   cascade;
drop table if exists symptom_checkins cascade;
drop table if exists pressure_events  cascade;
drop table if exists settings         cascade;   -- v1 global settings, replaced by user_settings
```
*(Linked to the Supabase CLI instead? `supabase db reset --linked` does the drop + re-run for you —
destructive, but the DB is empty so that's fine. This is also the safe way to re-run after any
partial failure, since it starts from a clean slate.)*

- [ ] **Verify** these exist after running: tables `profiles`, `user_settings`, `pressure_events`,
  `symptom_checkins`, `interventions`, `push_subscriptions`; view `event_outcomes`; trigger
  `on_auth_user_created`; RLS enabled with policies on every user table.

## 3. Environment variables (Vercel → Settings → Environment Variables, **Production**) 👤

Set **all of these before deploying** (Appendix A has where each comes from):
```
NEXT_PUBLIC_SUPABASE_URL          NEXT_PUBLIC_VAPID_PUBLIC_KEY
NEXT_PUBLIC_SUPABASE_ANON_KEY     VAPID_PRIVATE_KEY            🔒
SUPABASE_SERVICE_ROLE_KEY   🔒    VAPID_SUBJECT=mailto:mary.bowler@gmail.com
CRON_SECRET                 🔒    NEXT_PUBLIC_SITE_URL         (see Step 4c)
```
- [ ] **Remove** any v1 leftovers: `SLACK_WEBHOOK_URL`, `BENADRYL_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`.

## 4. Vercel deploy 💻👤

**4a.** `vercel link` (pick/confirm the project) → **4b.** `vercel --prod`.

**4c. The `NEXT_PUBLIC_SITE_URL` two-step** ⚠️ — if you didn't know the URL until the first deploy:
- [ ] Set `NEXT_PUBLIC_SITE_URL` to the real production URL, then **`vercel --prod` again** (rebuild).
- [ ] Go back to **Step 2a** and set Supabase Site URL + Redirect URL to that real URL.

**4d. Cron** — see the Pro/`pg_cron` caveat at the top. If on Pro: confirm the job under
Settings → Cron Jobs. If staying on Hobby: do Appendix B and remove `crons` from `vercel.json`.

## 5. Smoke test
- [ ] 👤 Visit `https://<site>/login` → enter your email → click the magic link.
- [ ] 🤖 Confirm you land authenticated on home, and a `profiles` row was auto-created (Supabase table view).
- [ ] 👤 Settings → set location + thresholds. **Yours: Kingston, OK (34.2334, −96.7167), 6 mbar / 3 hrs.**
- [ ] 💻 Manually trigger the cron: `curl -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/cron/check-pressure`
      → expect `200` with a JSON summary. *No event created ≠ failure* — it depends on the real forecast.

## 6. Push notifications, per device 👤 (iPhone order is mandatory)
1. Safari → open the site → Share → **Add to Home Screen** ← **must be first**
2. Open the app **from the Home Screen icon** (not Safari)
3. Settings → **Enable notifications** → accept the prompt
4. 🤖 Confirm a row appears in `push_subscriptions`
5. Force a real push: temporarily set your threshold to **1 mbar / 3 hrs**, run the Step 5 curl →
   the notification should arrive → tap → it deep-links to `/checkin?event_id=…&prompt=start` →
   then **restore 6 / 3** and delete the test event.
   *(Push needs HTTPS — it never fires on localhost.)*

## 7. Cleanup & onboarding 👤
- [ ] **Delete the unused Slack incoming webhook** (v1 relic, nothing references it).
- [ ] Add **Zeph** as a GitHub collaborator (Settings → Collaborators) — also unblocks his connector plan.
- [ ] Zeph onboards: `/login`, sets his own location/thresholds, enables push (same Home-Screen-first rule).

---

## Appendix A — env var sources
| Var | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL | build-time |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page → anon / public key | build-time |
| `SUPABASE_SERVICE_ROLE_KEY` 🔒 | same page → service_role key | server-only, bypasses RLS |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Step 1 output | build-time |
| `VAPID_PRIVATE_KEY` 🔒 | Step 1 output | server-only |
| `VAPID_SUBJECT` | literal `mailto:mary.bowler@gmail.com` | |
| `CRON_SECRET` 🔒 | your password manager | must match the Bearer token the route checks |
| `NEXT_PUBLIC_SITE_URL` | your Vercel prod URL | **build-time — set before the promoted build (Step 4c)** |

## Appendix B — (optional) run the cron from Supabase `pg_cron` to stay on Vercel Hobby
Enable the **`pg_cron`** and **`pg_net`** extensions (Database → Extensions), then in the SQL editor:
```sql
select cron.schedule(
  'check-pressure-3h',
  '0 */3 * * *',
  $$
  select net.http_get(
    url     := 'https://YOUR-APP.vercel.app/api/cron/check-pressure',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET')
  );
  $$
);
```
The route is a `GET` that checks `Authorization: Bearer $CRON_SECRET`, so this matches it exactly.
Then **remove the `crons` block from `vercel.json`** so you're not relying on Vercel's scheduler.
Note: the secret is stored in the `cron.job` table (readable by the `postgres` role) — fine for a
personal 2-user app; use Supabase **Vault** if you'd rather not have it in plaintext there.
