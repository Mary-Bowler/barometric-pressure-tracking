import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const db = createServerClient()
  const { searchParams } = new URL(req.url)
  const eventId = searchParams.get('event_id')

  let query = db
    .from('symptom_checkins')
    .select('*')
    .order('recorded_at', { ascending: false })
    .limit(100)

  if (eventId) query = query.eq('event_id', eventId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const db = createServerClient()
  const body = await req.json()

  const { data, error } = await db
    .from('symptom_checkins')
    .insert({
      event_id: body.event_id ?? null,
      recorded_at: body.recorded_at ?? new Date().toISOString(),
      entry_method: body.entry_method ?? 'pwa',
      severity: parseInt(body.severity),
      symptom_types: body.symptom_types ?? [],
      note: body.note ?? null,
      prompt_type: body.prompt_type ?? 'manual',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If this is the first checkin for an event and severity > 0, ensure first_intervention_at is set
  // when an intervention is later logged — nothing needed here

  return NextResponse.json(data, { status: 201 })
}
