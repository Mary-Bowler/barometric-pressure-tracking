import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { fetchPressureForecast, detectPressureEvent } from '@/lib/openmeteo'
import { sendPushToUser } from '@/lib/push'
import type { UserSettings } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://your-app.vercel.app'
  const now = new Date()

  // --- Step 1: Send pending midpoint/peak notifications ---
  const { data: dueMidpoint } = await db
    .from('pressure_events')
    .select('id, user_id')
    .eq('status', 'active')
    .lte('midpoint_due_at', now.toISOString())
    .is('midpoint_notified_at', null)

  for (const event of dueMidpoint ?? []) {
    try {
      await sendPushToUser(event.user_id, {
        title: 'Mid-event check-in',
        body: 'How are you feeling now?',
        url: `${siteUrl}/checkin?event_id=${event.id}&prompt=midpoint`,
      })
      await db
        .from('pressure_events')
        .update({ midpoint_notified_at: now.toISOString() })
        .eq('id', event.id)
    } catch (e) {
      console.error('[cron] midpoint push failed', event.id, e)
    }
  }

  const { data: duePeak } = await db
    .from('pressure_events')
    .select('id, user_id')
    .eq('status', 'active')
    .lte('peak_due_at', now.toISOString())
    .is('peak_notified_at', null)

  for (const event of duePeak ?? []) {
    try {
      await sendPushToUser(event.user_id, {
        title: 'Peak check-in',
        body: 'Pressure should be peaking now — log how you feel.',
        url: `${siteUrl}/checkin?event_id=${event.id}&prompt=peak`,
      })
      await db
        .from('pressure_events')
        .update({ peak_notified_at: now.toISOString() })
        .eq('id', event.id)
    } catch (e) {
      console.error('[cron] peak push failed', event.id, e)
    }
  }

  // Auto-complete events past their end time
  const { data: overdueEvents } = await db
    .from('pressure_events')
    .select('id')
    .eq('status', 'active')
    .lt('event_end', now.toISOString())

  for (const event of overdueEvents ?? []) {
    await db.from('pressure_events').update({ status: 'completed' }).eq('id', event.id)
  }

  // --- Step 2: Detect new events for every user ---
  const { data: allSettings, error: settingsError } = await db
    .from('user_settings')
    .select('*')
    .returns<UserSettings[]>()

  if (settingsError || !allSettings?.length) {
    return NextResponse.json({ ok: true, reason: 'No user settings found' })
  }

  // Dedupe Open-Meteo fetches by rounded coordinate pair
  const forecastCache = new Map<string, Awaited<ReturnType<typeof fetchPressureForecast>>>()
  const cacheKey = (lat: number, lng: number) => `${lat.toFixed(3)},${lng.toFixed(3)}`

  let eventsCreated = 0

  for (const s of allSettings) {
    const key = cacheKey(s.location_lat, s.location_lng)
    let readings = forecastCache.get(key)
    if (!readings) {
      try {
        readings = await fetchPressureForecast(s.location_lat, s.location_lng)
        forecastCache.set(key, readings)
      } catch (e) {
        console.error(`[cron] forecast fetch failed for user ${s.user_id}`, e)
        continue
      }
    }

    const detected = detectPressureEvent(readings, s.alert_threshold_mbar, s.alert_threshold_hours)
    if (!detected) continue

    // Duplicate guard: skip if an active event exists within ±6 hours of this start
    const windowStart = new Date(new Date(detected.event_start).getTime() - 6 * 3_600_000).toISOString()
    const windowEnd = new Date(new Date(detected.event_start).getTime() + 6 * 3_600_000).toISOString()

    const { data: existing } = await db
      .from('pressure_events')
      .select('id')
      .eq('user_id', s.user_id)
      .eq('source', 'auto')
      .gte('event_start', windowStart)
      .lte('event_start', windowEnd)
      .limit(1)

    if (existing && existing.length > 0) continue

    const eventStart = new Date(detected.event_start)
    const durationHrs = detected.forecasted_duration_hrs
    const midpointDue = new Date(eventStart.getTime() + (durationHrs / 2) * 3_600_000)
    const peakDue = new Date(eventStart.getTime() + durationHrs * 3_600_000)

    const { data: newEvent, error: insertError } = await db
      .from('pressure_events')
      .insert({
        user_id: s.user_id,
        event_start: detected.event_start,
        event_end: detected.event_end,
        direction: detected.direction,
        forecasted_change_mbar: detected.forecasted_change_mbar,
        forecasted_duration_hrs: detected.forecasted_duration_hrs,
        actual_pressure_start: detected.actual_pressure_start,
        source: 'auto',
        midpoint_due_at: midpointDue.toISOString(),
        peak_due_at: peakDue.toISOString(),
      })
      .select()
      .single()

    if (insertError || !newEvent) {
      console.error(`[cron] insert failed for user ${s.user_id}`, insertError?.message)
      continue
    }

    eventsCreated++

    try {
      await sendPushToUser(s.user_id, {
        title: `Pressure ${detected.direction} — ${s.location_label || 'your location'}`,
        body: `${detected.forecasted_change_mbar} mbar over ${detected.forecasted_duration_hrs}h. Tap to check in.`,
        url: `${siteUrl}/checkin?event_id=${newEvent.id}&prompt=start`,
      })
    } catch (e) {
      console.error(`[cron] start push failed for user ${s.user_id}`, e)
    }
  }

  return NextResponse.json({
    ok: true,
    users: allSettings.length,
    eventsCreated,
  })
}
