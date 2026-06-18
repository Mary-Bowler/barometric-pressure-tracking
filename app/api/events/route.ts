import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const limit = parseInt(searchParams.get('limit') ?? '50')

  let query = supabase
    .from('pressure_events')
    .select('*')
    .order('event_start', { ascending: false })
    .limit(limit)

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const eventStart = new Date(body.event_start)
  const durationHrs = parseFloat(body.forecasted_duration_hrs)
  const midpointDue = new Date(eventStart.getTime() + (durationHrs / 2) * 3_600_000)
  const peakDue = new Date(eventStart.getTime() + durationHrs * 3_600_000)

  const { data, error } = await supabase
    .from('pressure_events')
    .insert({
      user_id: user.id,
      event_start: body.event_start,
      event_end: body.event_end ?? null,
      direction: body.direction,
      forecasted_change_mbar: parseFloat(body.forecasted_change_mbar),
      forecasted_duration_hrs: durationHrs,
      actual_pressure_start: body.actual_pressure_start ?? null,
      source: body.source ?? 'manual',
      notes: body.notes ?? null,
      midpoint_due_at: midpointDue.toISOString(),
      peak_due_at: peakDue.toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, ...updates } = body

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('pressure_events')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
