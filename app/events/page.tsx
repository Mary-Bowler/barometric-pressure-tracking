import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Nav from '@/components/Nav'
import LocalTime from '@/components/LocalTime'
import type { PressureEvent } from '@/lib/types'

async function getEvents(): Promise<PressureEvent[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('pressure_events')
    .select('*')
    .order('event_start', { ascending: false })
    .limit(50)
  return (data ?? []) as PressureEvent[]
}

export const revalidate = 0

export default async function EventsPage() {
  const events = await getEvents()

  return (
    <main className="flex-1 px-4 pt-6 pb-24">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Events</h1>
        <Link
          href="/events/new"
          className="bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-lg"
        >
          + New
        </Link>
      </div>

      {events.length === 0 && (
        <p className="text-slate-500 text-sm text-center py-12">No events yet.</p>
      )}

      <div className="space-y-3">
        {events.map(e => (
          <Link
            key={e.id}
            href={`/events/${e.id}`}
            className="block bg-slate-800 border border-slate-700 rounded-xl p-4 hover:border-slate-500 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      e.status === 'active' ? 'bg-green-400 animate-pulse' : 'bg-slate-500'
                    }`}
                  />
                  <span className="text-xs text-slate-400 uppercase">
                    {e.status === 'active' ? 'Active' : 'Completed'}
                  </span>
                  <span className="text-xs text-slate-500">&middot; {e.source}</span>
                </div>
                <p className="font-semibold text-slate-100">
                  {e.direction === 'falling' ? '↓' : '↑'} {e.forecasted_change_mbar} mbar{' '}
                  <span className="text-slate-400 font-normal text-sm">
                    over {e.forecasted_duration_hrs}h
                  </span>
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {e.rate_mbar_hr?.toFixed(2) ?? '—'} mbar/hr
                </p>
              </div>
              <LocalTime
                iso={e.event_start}
                className="text-xs text-slate-500 text-right flex-shrink-0"
              />
            </div>
          </Link>
        ))}
      </div>
      <Nav />
    </main>
  )
}
