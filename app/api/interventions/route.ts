import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const eventId = searchParams.get('event_id')

  let query = supabase
    .from('interventions')
    .select('*')
    .order('recorded_at', { ascending: false })
    .limit(100)

  if (eventId) query = query.eq('event_id', eventId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const recordedAt = body.recorded_at ?? new Date().toISOString()

  const { data, error } = await supabase
    .from('interventions')
    .insert({
      user_id: user.id,
      event_id: body.event_id ?? null,
      checkin_id: body.checkin_id ?? null,
      recorded_at: recordedAt,
      type: body.type,
      perceived_effectiveness:
        body.perceived_effectiveness != null ? parseInt(body.perceived_effectiveness) : null,
      source: 'manual',
      notes: body.notes ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update first_intervention_at on the event if not yet set
  if (body.event_id) {
    const { error: evtErr } = await supabase
      .from('pressure_events')
      .update({ first_intervention_at: recordedAt })
      .eq('id', body.event_id)
      .eq('user_id', user.id)
      .is('first_intervention_at', null)
    if (evtErr) {
      console.error('[interventions] first_intervention_at update failed', evtErr)
    }
  }

  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id } = body

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Allowlist: never spread the raw body into .update()
  const updates: Record<string, unknown> = {}
  for (const key of ['type', 'perceived_effectiveness', 'notes', 'recorded_at'] as const) {
    if (key in body) updates[key] = body[key]
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no updatable fields provided' }, { status: 400 })
  }

  // RLS ensures users can only update their own rows; user_id filter is belt-and-suspenders
  const { data, error } = await supabase
    .from('interventions')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
