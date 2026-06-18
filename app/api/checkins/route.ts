import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const eventId = searchParams.get('event_id')

  let query = supabase
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()

  const { data, error } = await supabase
    .from('symptom_checkins')
    .insert({
      user_id: user.id,
      event_id: body.event_id ?? null,
      recorded_at: body.recorded_at ?? new Date().toISOString(),
      entry_method: 'pwa',
      severity: parseInt(body.severity),
      symptom_types: body.symptom_types ?? [],
      note: body.note ?? null,
      prompt_type: body.prompt_type ?? 'manual',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}
