import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Nav from '@/components/Nav'
import LocalTime from '@/components/LocalTime'
import type { PressureEvent, SymptomCheckin, Intervention } from '@/lib/types'
import { INTERVENTION_OPTIONS } from '@/lib/types'

export const revalidate = 0

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function getEvent(id: string) {
  const supabase = await createClient()

  const [eventRes, checkinsRes, interventionsRes] = await Promise.all([
    supabase.from('pressure_events').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('symptom_checkins')
      .select('*')
      .eq('event_id', id)
      .order('recorded_at', { ascending: true }),
    supabase
      .from('interventions')
      .select('*')
      .eq('event_id', id)
      .order('recorded_at', { ascending: true }),
  ])

  return {
    event: eventRes.data as PressureEvent | null,
    checkins: (checkinsRes.data ?? []) as SymptomCheckin[],
    interventions: (interventionsRes.data ?? []) as Intervention[],
  }
}

function interventionLabel(type: string) {
  return INTERVENTION_OPTIONS.find(o => o.value === type)?.label ?? type
}

function severityColor(severity: number) {
  return severity <= 3 ? '#22c55e' : severity <= 6 ? '#eab308' : '#ef4444'
}

export default async function EventDetailPage({ params }: { params: { id: string } }) {
  if (!UUID_RE.test(params.id)) notFound()

  const { event, checkins, interventions } = await getEvent(params.id)
  if (!event) notFound()

  return (
    <main className="flex-1 px-4 pt-6 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/events" className="text-slate-400 text-sm">
          &larr; Events
        </Link>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              event.status === 'active' ? 'bg-green-400 animate-pulse' : 'bg-slate-500'
            }`}
          />
          <span className="text-xs text-slate-400 uppercase">
            {event.status === 'active' ? 'Active' : 'Completed'}
          </span>
          <span className="text-xs text-slate-500">&middot; {event.source}</span>
        </div>

        <p className="text-xl font-bold text-slate-100 mb-1">
          {event.direction === 'falling' ? '↓' : '↑'} {event.forecasted_change_mbar} mbar{' '}
          <span className="text-slate-400 font-normal text-base">
            over {event.forecasted_duration_hrs}h
          </span>
        </p>
        <p className="text-sm text-slate-400 mb-3">
          {event.rate_mbar_hr != null ? `${Number(event.rate_mbar_hr).toFixed(2)} mbar/hr` : '—'}
        </p>

        <div className="text-xs text-slate-500 space-y-1">
          <p>
            Starts: <LocalTime iso={event.event_start} className="text-slate-400" />
          </p>
          {event.event_end && (
            <p>
              Ends: <LocalTime iso={event.event_end} className="text-slate-400" />
            </p>
          )}
          {event.actual_pressure_start != null && (
            <p>
              Starting pressure:{' '}
              <span className="text-slate-400">{event.actual_pressure_start} mbar</span>
            </p>
          )}
        </div>

        {event.notes && <p className="text-sm text-slate-300 mt-3">{event.notes}</p>}
      </div>

      <Link
        href={`/checkin?event_id=${event.id}&prompt=manual`}
        className="block w-full bg-indigo-500 hover:bg-indigo-400 text-white text-center font-semibold py-3 rounded-xl mb-8 transition-colors"
      >
        Log Check-in
      </Link>

      <section className="mb-8">
        <h2 className="text-xs text-slate-500 uppercase tracking-wide mb-3">
          Check-ins ({checkins.length})
        </h2>
        {checkins.length === 0 && (
          <p className="text-slate-500 text-sm">No check-ins for this event yet.</p>
        )}
        <div className="space-y-2">
          {checkins.map(c => (
            <div
              key={c.id}
              className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold" style={{ color: severityColor(c.severity) }}>
                    {c.severity}
                  </span>
                  <span className="text-sm text-slate-300">
                    {c.symptom_types.join(', ').replace(/_/g, ' ') || 'no symptoms listed'}
                  </span>
                </div>
                <div className="text-right text-xs text-slate-500 flex-shrink-0">
                  <LocalTime iso={c.recorded_at} mode="time" />
                  {c.prompt_type && <p className="uppercase">{c.prompt_type}</p>}
                </div>
              </div>
              {c.note && <p className="text-xs text-slate-500 mt-1">{c.note}</p>}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xs text-slate-500 uppercase tracking-wide mb-3">
          Interventions ({interventions.length})
        </h2>
        {interventions.length === 0 && (
          <p className="text-slate-500 text-sm">No interventions logged for this event.</p>
        )}
        <div className="space-y-2">
          {interventions.map(i => (
            <div
              key={i.id}
              className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 flex items-center justify-between gap-2"
            >
              <div>
                <p className="text-sm font-medium text-slate-200">{interventionLabel(i.type)}</p>
                {i.perceived_effectiveness != null && (
                  <p className="text-xs text-slate-500">
                    Effectiveness: {i.perceived_effectiveness}/10
                  </p>
                )}
                {i.notes && <p className="text-xs text-slate-500 mt-0.5">{i.notes}</p>}
              </div>
              <LocalTime
                iso={i.recorded_at}
                mode="time"
                className="text-xs text-slate-500 flex-shrink-0"
              />
            </div>
          ))}
        </div>
      </section>

      <Nav />
    </main>
  )
}
