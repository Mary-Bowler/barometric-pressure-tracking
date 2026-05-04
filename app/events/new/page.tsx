'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Nav from '@/components/Nav'
import type { Direction } from '@/lib/types'

export default function NewEventPage() {
  const router = useRouter()
  const [direction, setDirection] = useState<Direction>('falling')
  const [changeMbar, setChangeMbar] = useState('')
  const [durationHrs, setDurationHrs] = useState('')
  const [eventStart, setEventStart] = useState(
    new Date(Date.now() - new Date().getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 16)
  )
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const rate =
    changeMbar && durationHrs
      ? (parseFloat(changeMbar) / parseFloat(durationHrs)).toFixed(2)
      : null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!changeMbar || !durationHrs) {
      setError('Change and duration are required.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction,
          forecasted_change_mbar: changeMbar,
          forecasted_duration_hrs: durationHrs,
          event_start: new Date(eventStart).toISOString(),
          notes: notes || null,
          source: 'manual',
        }),
      })
      if (!res.ok) throw new Error('Failed')
      const event = await res.json()
      router.push(`/checkin?event_id=${event.id}&prompt=start`)
    } catch {
      setError('Something went wrong.')
      setSubmitting(false)
    }
  }

  return (
    <main className="flex-1 px-4 pt-6 pb-24">
      <h1 className="text-xl font-bold mb-6">Log Event</h1>

      <form onSubmit={submit} className="space-y-6">
        {/* Direction */}
        <div className="space-y-2">
          <label className="text-sm text-slate-400 uppercase tracking-wide">Direction</label>
          <div className="grid grid-cols-2 gap-2">
            {(['falling', 'rising'] as Direction[]).map(d => (
              <button
                key={d}
                type="button"
                onClick={() => setDirection(d)}
                className={`py-3 rounded-xl text-sm font-semibold border transition-colors ${
                  direction === d
                    ? 'bg-indigo-500 border-indigo-400 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                {d === 'falling' ? '↓ Falling' : '↑ Rising'}
              </button>
            ))}
          </div>
        </div>

        {/* Change */}
        <div className="space-y-2">
          <label className="text-sm text-slate-400 uppercase tracking-wide">
            Forecasted Change (mbar)
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={changeMbar}
            onChange={e => setChangeMbar(e.target.value)}
            placeholder="e.g. 8"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-3 text-slate-100 text-base focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Duration */}
        <div className="space-y-2">
          <label className="text-sm text-slate-400 uppercase tracking-wide">
            Forecasted Duration (hours)
          </label>
          <input
            type="number"
            step="0.5"
            min="0"
            value={durationHrs}
            onChange={e => setDurationHrs(e.target.value)}
            placeholder="e.g. 6"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-3 text-slate-100 text-base focus:outline-none focus:border-indigo-500"
          />
          {rate && (
            <p className="text-xs text-slate-400">
              Rate: <span className="text-indigo-300 font-semibold">{rate} mbar/hr</span>
            </p>
          )}
        </div>

        {/* Start time */}
        <div className="space-y-2">
          <label className="text-sm text-slate-400 uppercase tracking-wide">Start Time</label>
          <input
            type="datetime-local"
            value={eventStart}
            onChange={e => setEventStart(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-3 text-slate-100 text-base focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <label className="text-sm text-slate-400 uppercase tracking-wide">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 text-sm resize-none focus:outline-none focus:border-indigo-500"
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-lg font-semibold py-4 rounded-xl"
        >
          {submitting ? 'Saving…' : 'Create Event'}
        </button>
      </form>
      <Nav />
    </main>
  )
}
