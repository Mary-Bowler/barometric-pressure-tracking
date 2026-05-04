import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const db = createServerClient()
  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')

  // Fetch events with their checkins and interventions
  let eventsQuery = db
    .from('pressure_events')
    .select(`
      *,
      symptom_checkins (severity, symptom_types, recorded_at, prompt_type),
      interventions (type, perceived_effectiveness, recorded_at, source)
    `)
    .order('event_start', { ascending: false })

  if (start) eventsQuery = eventsQuery.gte('event_start', start)
  if (end) eventsQuery = eventsQuery.lte('event_start', end)

  const { data, error } = await eventsQuery
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows: string[] = []
  const headers = [
    'event_id',
    'event_start',
    'direction',
    'forecasted_change_mbar',
    'forecasted_duration_hrs',
    'rate_mbar_hr',
    'source',
    'status',
    'first_intervention_at',
    'hours_to_first_intervention',
    'peak_severity',
    'avg_severity',
    'checkin_count',
    'symptoms',
    'interventions',
  ]
  rows.push(headers.join(','))

  for (const event of data ?? []) {
    const checkins = event.symptom_checkins ?? []
    const interventions = event.interventions ?? []

    const severities = checkins.map((c: any) => c.severity)
    const peakSeverity = severities.length > 0 ? Math.max(...severities) : ''
    const avgSeverity =
      severities.length > 0
        ? (severities.reduce((a: number, b: number) => a + b, 0) / severities.length).toFixed(2)
        : ''

    const allSymptoms = Array.from(new Set<string>(checkins.flatMap((c: any) => c.symptom_types ?? []))).join(';')
    const interventionSummary = interventions.map((i: any) => i.type).join(';')

    let hoursToFirst = ''
    if (event.first_intervention_at && event.event_start) {
      const diff =
        (new Date(event.first_intervention_at).getTime() - new Date(event.event_start).getTime()) /
        3_600_000
      hoursToFirst = diff.toFixed(2)
    }

    const row = [
      event.id,
      event.event_start,
      event.direction,
      event.forecasted_change_mbar,
      event.forecasted_duration_hrs,
      event.rate_mbar_hr ?? '',
      event.source,
      event.status,
      event.first_intervention_at ?? '',
      hoursToFirst,
      peakSeverity,
      avgSeverity,
      checkins.length,
      `"${allSymptoms}"`,
      `"${interventionSummary}"`,
    ]
    rows.push(row.join(','))
  }

  const csv = rows.join('\n')
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="pressure-tracker-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
