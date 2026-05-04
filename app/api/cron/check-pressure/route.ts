import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { fetchPressureForecast, detectPressureEvent } from '@/lib/openmeteo'
import { sendEventNotification } from '@/lib/slack'
import type { Settings } from '@/lib/types'

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServerClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-app.vercel.app'

  // Load settings
  const { data: settingsRows } = await db.from('settings').select('key, value')
  const settings: Record<string, string> = {}
  for (const row of settingsRows ?? []) settings[row.key] = row.value

  const lat = parseFloat(settings.location_lat ?? '34.2334')
  const lng = parseFloat(settings.location_lng ?? '-96.7167')
  const thresholdMbar = parseFloat(settings.alert_threshold_mbar ?? '6')
  const thresholdHours = parseFloat(settings.alert_threshold_hours ?? '3')
  const webhookUrl = settings.slack_webhook_url || process.env.SLACK_WEBHOOK_URL

  if (!webhookUrl) {
    return NextResponse.json({ ok: false, reason: 'No Slack webhook configured' })
  }

  // === Step 1: Send pending midpoint/peak notifications for active events ===
  const now = new Date()
  const { data: activeEvents } = await db
    .from('pressure_events')
    .select('*')
    .eq('status', 'active')

  for (const event of activeEvents ?? []) {
    // Midpoint
    if (
      event.midpoint_due_at &&
      !event.midpoint_notified_at &&
      new Date(event.midpoint_due_at) <= now
    ) {
      try {
        await sendEventNotification(event, 'midpoint', appUrl, webhookUrl)
        await db
          .from('pressure_events')
          .update({ midpoint_notified_at: now.toISOString() })
          .eq('id', event.id)
      } catch (e) {
        console.error('Failed to send midpoint notification', e)
      }
    }

    // Peak
    if (
      event.peak_due_at &&
      !event.peak_notified_at &&
      new Date(event.peak_due_at) <= now
    ) {
      try {
        await sendEventNotification(event, 'peak', appUrl, webhookUrl)
        await db
          .from('pressure_events')
          .update({ peak_notified_at: now.toISOString() })
          .eq('id', event.id)
      } catch (e) {
        console.error('Failed to send peak notification', e)
      }
    }

    // Auto-complete events that are past their end time
    if (event.event_end && new Date(event.event_end) < now) {
      await db
        .from('pressure_events')
        .update({ status: 'completed' })
        .eq('id', event.id)
    }
  }

  // === Step 2: Detect new events ===
  let readings
  try {
    readings = await fetchPressureForecast(lat, lng)
  } catch (e) {
    return NextResponse.json({ ok: false, reason: 'Open-Meteo fetch failed', error: String(e) })
  }

  const detected = detectPressureEvent(readings, thresholdMbar, thresholdHours)
  if (!detected) {
    return NextResponse.json({ ok: true, reason: 'No threshold-crossing event detected' })
  }

  // Check for duplicate: any active event starting within 6 hours of this one
  const windowStart = new Date(new Date(detected.event_start).getTime() - 6 * 3_600_000).toISOString()
  const windowEnd = new Date(new Date(detected.event_start).getTime() + 6 * 3_600_000).toISOString()

  const { data: existing } = await db
    .from('pressure_events')
    .select('id')
    .gte('event_start', windowStart)
    .lte('event_start', windowEnd)
    .eq('source', 'auto')
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({ ok: true, reason: 'Duplicate event, skipping' })
  }

  // Create the event
  const eventStart = new Date(detected.event_start)
  const durationHrs = detected.forecasted_duration_hrs
  const midpointDue = new Date(eventStart.getTime() + (durationHrs / 2) * 3_600_000)
  const peakDue = new Date(eventStart.getTime() + durationHrs * 3_600_000)

  const { data: newEvent, error: insertError } = await db
    .from('pressure_events')
    .insert({
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
    return NextResponse.json({ ok: false, reason: 'Insert failed', error: insertError?.message })
  }

  // Send start notification
  try {
    await sendEventNotification(newEvent, 'start', appUrl, webhookUrl)
    await db
      .from('pressure_events')
      .update({ midpoint_notified_at: null }) // clear just in case
      .eq('id', newEvent.id)
  } catch (e) {
    console.error('Failed to send start notification', e)
  }

  return NextResponse.json({ ok: true, event: newEvent })
}
