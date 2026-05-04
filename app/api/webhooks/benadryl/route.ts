import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  // Simple shared secret check
  const secret = req.headers.get('x-webhook-secret')
  if (process.env.BENADRYL_WEBHOOK_SECRET && secret !== process.env.BENADRYL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { gcal_event_id, timestamp, title } = body

  if (!timestamp) {
    return NextResponse.json({ error: 'timestamp required' }, { status: 400 })
  }

  const db = createServerClient()
  const recordedAt = new Date(timestamp).toISOString()

  // Find the active pressure event at this timestamp (if any)
  const { data: activeEvents } = await db
    .from('pressure_events')
    .select('id')
    .eq('status', 'active')
    .lte('event_start', recordedAt)
    .order('event_start', { ascending: false })
    .limit(1)

  const eventId = activeEvents?.[0]?.id ?? null

  // Upsert: avoid duplicating if Zapier retries
  const { data, error } = await db
    .from('interventions')
    .upsert(
      {
        event_id: eventId,
        recorded_at: recordedAt,
        type: 'benadryl',
        source: 'benadryl_gcal',
        notes: title ?? 'Benadryl (from Google Calendar)',
      },
      {
        onConflict: 'source,recorded_at',
        ignoreDuplicates: true,
      }
    )
    .select()
    .single()

  if (error && error.code !== '23505') {
    // 23505 = unique violation (duplicate), which is fine
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Update first_intervention_at if needed
  if (eventId) {
    await db
      .from('pressure_events')
      .update({ first_intervention_at: recordedAt })
      .eq('id', eventId)
      .is('first_intervention_at', null)
  }

  return NextResponse.json({ ok: true, intervention: data })
}
