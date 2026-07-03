# System Architecture

## Workflow Diagram

```mermaid
flowchart TD
    subgraph External["External Services"]
        OM["Open-Meteo API\n(free weather API)"]
        PUSH["Web Push / VAPID\n(browser push service)"]
    end

    subgraph Vercel["Vercel (Next.js App)"]
        CRON["Cron Job\n/api/cron/check-pressure\nevery 3 hours"]
        SUB["Subscribe Route\n/api/push/subscribe"]
        PWA["PWA UI\n(mobile, Safari)"]
        SW["Service Worker\npublic/sw.js"]
        SUGGEST["Suggestion Engine\nlib/suggestions.ts"]
        AUTH["Auth Middleware\nmiddleware.ts"]
    end

    subgraph Supabase["Supabase (PostgreSQL + Auth)"]
        AUTHDB["auth.users\n(magic link)"]
        PROF["profiles"]
        US["user_settings\n(per-user location + thresholds)"]
        PE["pressure_events\n(user_id)"]
        SC["symptom_checkins\n(user_id)"]
        IV["interventions\n(user_id)"]
        PS["push_subscriptions\n(user_id)"]
        EO["event_outcomes\n(view, security_invoker)"]
    end

    %% Auth flow
    PWA -->|"magic link email"| AUTHDB
    AUTHDB -->|"session cookie"| AUTH
    AUTH -->|"redirect if unauthed"| PWA

    %% Profile auto-creation
    AUTHDB -->|"on_auth_user_created trigger"| PROF

    %% Settings
    US -->|"location, thresholds\nper user"| CRON

    %% Pressure detection loop
    CRON -->|"fetch hourly forecast\nper unique location"| OM
    OM -->|"pressure data"| CRON
    CRON -->|"detected event (per user)\nexceeds threshold"| PE
    CRON -->|"send push to all\nuser subscriptions"| PUSH

    %% Push → check-in
    PUSH -->|"notification with\ndeep-link"| SW
    SW -->|"tap → /checkin?event_id=id"| PWA

    %% Push subscription management
    PWA -->|"subscribe (VAPID)"| SW
    SW -->|"PushSubscription"| SUB
    SUB -->|"endpoint + keys"| PS

    %% PWA check-in flow
    PWA -->|"step 1: severity 0–10\nstep 2: symptom types\nstep 3: intervention"| SC
    PWA --> IV
    SC -->|"linked to event"| PE
    IV -->|"linked to event"| PE

    %% Suggestion engine
    SC -->|"past effectiveness data"| SUGGEST
    SUGGEST -->|"recommended intervention"| PWA

    %% Analysis
    PE --> EO
    SC --> EO
    EO -->|"correlation charts"| PWA
```

## Data Flow Summary

| Trigger | Path | Result |
|---|---|---|
| User visits app (unauthenticated) | `middleware.ts` | Redirect to `/login` |
| User submits email on `/login` | Supabase Auth magic link | Email sent; click → `/auth/callback` → session set |
| New user signs in for first time | `on_auth_user_created` trigger | `profiles` row auto-created |
| Every 3 hours | Vercel cron → reads all `user_settings` → Open-Meteo (deduped by location) | New `pressure_event` per user if threshold exceeded |
| Pressure event detected | Cron → `lib/push.ts` → VAPID push service | Push notification sent to all user's subscriptions |
| User taps notification | Service worker deep-link → `/checkin?event_id=<id>` | PWA check-in flow opens |
| User opens PWA directly | PWA → Supabase (RLS-scoped) | Manual check-in or retroactive entry |
| User enables notifications in Settings | `lib/push-client.ts` → SW registration → `/api/push/subscribe` | `push_subscriptions` row saved |
| User views Analysis tab | PWA → `event_outcomes` view | Correlation charts (Recharts); view returns only user's own rows via RLS |

## Database Schema

```
auth.users             Supabase Auth — one row per user (managed by Supabase)
profiles               Display name; 1:1 with auth.users; auto-created on signup
user_settings          Per-user location, alert thresholds (replaces global key/value settings)
pressure_events        One row per detected or manual pressure event; user_id NOT NULL
symptom_checkins       Severity + symptom types, linked to an event; user_id NOT NULL
interventions          Treatments logged: benadryl, triptan, ubrelvy, hydration, movement, rest, other
push_subscriptions     VAPID push endpoints per user/device (endpoint + p256dh + auth)
event_outcomes         VIEW — aggregates peak/avg severity and intervention timing per event
                         (security_invoker: respects caller's RLS; includes user_id in GROUP BY)
```

## RLS Model

Every table has `user_id uuid NOT NULL references auth.users(id)` and a policy
`USING (auth.uid() = user_id)`. Users never see each other's data.

The **service-role key** (used only by the cron job and push-subscribe route) bypasses RLS,
giving the cron cross-user read access to `user_settings` and `push_subscriptions`.
