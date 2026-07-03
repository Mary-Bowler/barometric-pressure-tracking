import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? {})
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()

  const lat = Number(body.location_lat)
  const lng = Number(body.location_lng)
  const thresholdMbar = Number(body.alert_threshold_mbar ?? 6)
  const thresholdHours = Number(body.alert_threshold_hours ?? 3)

  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    return NextResponse.json({ error: 'location_lat and location_lng must be valid coordinates' }, { status: 400 })
  }
  if (!Number.isFinite(thresholdMbar) || thresholdMbar <= 0 || !Number.isFinite(thresholdHours) || thresholdHours <= 0) {
    return NextResponse.json({ error: 'alert thresholds must be positive numbers' }, { status: 400 })
  }

  const { error } = await supabase
    .from('user_settings')
    .upsert({
      user_id: user.id,
      location_lat: lat,
      location_lng: lng,
      location_label: body.location_label ?? '',
      alert_threshold_mbar: thresholdMbar,
      alert_threshold_hours: thresholdHours,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
