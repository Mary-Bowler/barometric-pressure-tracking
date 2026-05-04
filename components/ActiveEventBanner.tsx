'use client'

import Link from 'next/link'
import type { PressureEvent } from '@/lib/types'

interface Props {
  event: PressureEvent
}

function formatElapsed(eventStart: string): string {
  const ms = Date.now() - new Date(eventStart).getTime()
  const hrs = Math.floor(ms / 3_600_000)
  const mins = Math.floor((ms % 3_600_000) / 60_000)
  if (hrs > 0) return `${hrs}h ${mins}m`
  return `${mins}m`
}

export default function ActiveEventBanner({ event }: Props) {
  const directionLabel = event.direction === 'falling' ? 'Dropping' : 'Rising'
  const rate = event.rate_mbar_hr?.toFixed(2) ?? '—'
  const elapsed = formatElapsed(event.event_start)

  return (
    <div className="bg-indigo-900/60 border border-indigo-500/50 rounded-xl p-4 mb-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full animate-pulse ${event.direction === 'falling' ? 'bg-orange-400' : 'bg-blue-400'}`} />
            <span className="text-sm font-semibold text-indigo-200">Active Event</span>
          </div>
          <p className="text-lg font-bold text-white">
            {directionLabel} {event.forecasted_change_mbar} mbar
          </p>
          <p className="text-sm text-slate-300 mt-0.5">
            {rate} mbar/hr &middot; {event.forecasted_duration_hrs}h forecast &middot; {elapsed} in
          </p>
        </div>
        <Link
          href={`/checkin?event_id=${event.id}&prompt=manual`}
          className="flex-shrink-0 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-1"
        >
          Check in
        </Link>
      </div>
    </div>
  )
}
