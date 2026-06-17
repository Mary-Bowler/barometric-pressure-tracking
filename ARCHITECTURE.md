# System Architecture

## Workflow Diagram

```mermaid
flowchart TD
    subgraph External["External Services"]
        OM["Open-Meteo API\n(free weather API)"]
        SLACK["Slack\n#migraine-symptom"]
        GCAL["Google Calendar\n(Benadryl entries)"]
        ZAPIER["Zapier"]
    end

    subgraph Vercel["Vercel (Next.js App)"]
        CRON["Cron Job\n/api/cron/check-pressure\nevery 3 hours"]
        WEBHOOK["Webhook\n/api/webhooks/benadryl"]
        PWA["PWA UI\n(mobile, Safari)"]
        SUGGEST["Suggestion Engine\nlib/suggestions.ts"]
    end

    subgraph Supabase["Supabase (PostgreSQL)"]
        PE["pressure_events"]
        SC["symptom_checkins"]
        IV["interventions"]
        ST["settings"]
        EO["event_outcomes\n(view)"]
    end

    %% Pressure detection loop
    CRON -->|"fetch hourly forecast\nfor Kingston, OK"| OM
    OM -->|"pressure data"| CRON
    CRON -->|"detected event\nexceeds threshold"| PE
    CRON -->|"send alert with\ndeep-link button"| SLACK

    %% Slack → check-in
    SLACK -->|"user taps Log button\n(deep link)"| PWA

    %% PWA check-in flow
    PWA -->|"step 1: severity 0–10\nstep 2: symptom types\nstep 3: intervention"| SC
    PWA --> IV
    SC -->|"linked to event"| PE
    IV -->|"linked to event"| PE

    %% Suggestion engine
    SC -->|"past effectiveness data"| SUGGEST
    SUGGEST -->|"recommended intervention"| PWA

    %% Benadryl sync
    GCAL -->|"new Benadryl event"| ZAPIER
    ZAPIER -->|"POST + secret header"| WEBHOOK
    WEBHOOK -->|"type=benadryl\nsource=benadryl_gcal"| IV

    %% Settings
    ST -->|"location, thresholds,\nSlack URL"| CRON

    %% Analysis
    PE --> EO
    SC --> EO
    EO -->|"correlation charts"| PWA
```

## Data Flow Summary

| Trigger | Path | Result |
|---|---|---|
| Every 3 hours | Vercel cron → Open-Meteo → Supabase | New `pressure_event` created if threshold exceeded |
| Pressure event detected | Supabase → Slack notification | Alert sent with deep-link check-in button |
| User taps Slack button | Deep link → PWA check-in flow | `symptom_checkin` + optional `intervention` logged |
| User opens PWA directly | PWA → Supabase | Manual check-in or retroactive event entry |
| Benadryl logged in Google Calendar | Google Calendar → Zapier → webhook | `intervention` row created with `source=benadryl_gcal` |
| User views Analysis tab | PWA → `event_outcomes` view | Correlation charts rendered via Recharts |

## Database Schema

```
settings          key/value config (location, thresholds, Slack URL)
pressure_events   one row per detected or manual pressure event
symptom_checkins  severity + symptom types, linked to an event
interventions     treatments logged, linked to an event (+ optionally a check-in)
event_outcomes    VIEW — aggregates peak/avg severity and intervention timing per event
```
