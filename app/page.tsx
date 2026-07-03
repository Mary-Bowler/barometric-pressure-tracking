import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentPressure } from '@/lib/openmeteo'
import ActiveEventBanner from '@/components/ActiveEventBanner'
import Nav from '@/components/Nav'
import LocalTime from '@/components/LocalTime'
import type { PressureEvent, SymptomCheckin, UserSettings } from '@/lib/types'

async function getData() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { activeEvent: null, recentCheckins: [], settings: null }

  const [eventRes, checkinsRes, settingsRes] = await Promise.all([
    supabase
      .from('pressure_events')
      .select('*')
      .eq('status', 'active')
      .order('event_start', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('symptom_checkins')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(3),
    supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  return {
    activeEvent: eventRes.data as PressureEvent | null,
    recentCheckins: (checkinsRes.data ?? []) as SymptomCheckin[],
    settings: settingsRes.data as UserSettings | null,
  }
}

export const revalidate = 0

export default async function Home() {
  const { activeEvent, recentCheckins, settings } = await getData()

  const currentPressure =
    settings
      ? await getCurrentPressure(settings.location_lat, settings.location_lng)
      : null

  const checkinHref = activeEvent
    ? `/checkin?event_id=${activeEvent.id}&prompt=manual`
    : '/checkin'

  return (
    <main className="flex-1 px-4 pt-6 pb-24">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Pressure Tracker</h1>
          <p className="text-sm text-slate-400">
            {settings?.location_label || 'Set your location in Settings'}
          </p>
        </div>
        {currentPressure && (
          <div className="text-right">
            <p className="text-2xl font-bold text-slate-100">{currentPressure.toFixed(1)}</p>
            <p className="text-xs text-slate-500">mbar now</p>
          </div>
        )}
      </div>

      {activeEvent && <ActiveEventBanner event={activeEvent} />}

      <Link
        href={checkinHref}
        className="block w-full bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-600 text-white text-center text-lg font-semibold py-4 rounded-xl mb-3 transition-colors"
      >
        Log Check-in
      </Link>

      <div className="grid grid-cols-2 gap-3 mb-8">
        <Link
          href="/events/new"
          className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-center text-sm font-medium py-3 rounded-xl transition-colors"
        >
          New Event
        </Link>
        <Link
          href={activeEvent ? `/events?highlight=${activeEvent.id}` : '/events'}
          className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-center text-sm font-medium py-3 rounded-xl transition-colors"
        >
          All Events
        </Link>
      </div>

      {recentCheckins.length > 0 && (
        <section>
          <h2 className="text-xs text-slate-500 uppercase tracking-wide mb-3">Recent</h2>
          <div className="space-y-2">
            {recentCheckins.map(c => (
              <div
                key={c.id}
                className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className="text-lg font-bold"
                      style={{
                        color: c.severity <= 3 ? '#22c55e' : c.severity <= 6 ? '#eab308' : '#ef4444',
                      }}
                    >
                      {c.severity}
                    </span>
                    <span className="text-sm text-slate-300">
                      {c.symptom_types.join(', ').replace(/_/g, ' ')}
                    </span>
                  </div>
                  {c.note && <p className="text-xs text-slate-500 truncate max-w-[200px]">{c.note}</p>}
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p><LocalTime iso={c.recorded_at} mode="time" /></p>
                  <p><LocalTime iso={c.recorded_at} mode="date" /></p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {recentCheckins.length === 0 && !activeEvent && (
        <div className="text-center py-12">
          <p className="text-slate-500 text-sm">No events yet.</p>
          <p className="text-slate-600 text-xs mt-1">Tap Log Check-in to get started.</p>
        </div>
      )}

      <Nav />
    </main>
  )
}
