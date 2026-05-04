'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import SeveritySlider from '@/components/SeveritySlider'
import SymptomChips from '@/components/SymptomChips'
import InterventionSuggestions from '@/components/InterventionSuggestions'
import type { SymptomType, InterventionType, PressureEvent } from '@/lib/types'

const INTERVENTION_TYPES: { value: InterventionType; label: string }[] = [
  { value: 'movement', label: 'Movement' },
  { value: 'rest', label: 'Rest' },
  { value: 'benadryl', label: 'Benadryl' },
  { value: 'hydration', label: 'Hydration' },
  { value: 'other', label: 'Other' },
]

type Step = 'checkin' | 'intervention' | 'done'

function CheckinForm() {
  const router = useRouter()
  const params = useSearchParams()
  const eventId = params.get('event_id')
  const promptType = params.get('prompt') ?? 'manual'

  const [step, setStep] = useState<Step>('checkin')
  const [severity, setSeverity] = useState(5)
  const [symptoms, setSymptoms] = useState<SymptomType[]>([])
  const [note, setNote] = useState('')
  const [recordedAt, setRecordedAt] = useState('')
  const [showRetro, setShowRetro] = useState(false)
  const [checkinId, setCheckinId] = useState<string | null>(null)
  const [event, setEvent] = useState<PressureEvent | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Load event details
  useEffect(() => {
    if (!eventId) return
    fetch(`/api/events?status=active&limit=10`)
      .then(r => r.json())
      .then((events: PressureEvent[]) => {
        const match = events.find(e => e.id === eventId)
        setEvent(match ?? null)
      })
      .catch(() => {})
  }, [eventId])

  async function submitCheckin() {
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId ?? null,
          severity,
          symptom_types: symptoms,
          note: note || null,
          prompt_type: promptType,
          recorded_at: recordedAt || undefined,
          entry_method: 'pwa',
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      const checkin = await res.json()
      setCheckinId(checkin.id)
      setStep('intervention')
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function logIntervention(type: InterventionType) {
    if (!type) return
    await fetch('/api/interventions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: eventId ?? null,
        checkin_id: checkinId,
        type,
        source: 'manual',
      }),
    })
    setStep('done')
  }

  if (step === 'done') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <div className="text-5xl">✓</div>
        <h2 className="text-xl font-semibold text-slate-100">Logged</h2>
        <p className="text-slate-400 text-sm">Check-in saved successfully.</p>
        <button
          onClick={() => router.push('/')}
          className="mt-4 bg-indigo-500 text-white px-8 py-3 rounded-xl font-semibold"
        >
          Done
        </button>
      </div>
    )
  }

  if (step === 'intervention') {
    return (
      <div className="flex flex-col gap-6 px-4 pt-6 pb-24">
        <div>
          <h1 className="text-xl font-bold text-slate-100 mb-1">Checked in — severity {severity}</h1>
          <p className="text-slate-400 text-sm">Did you try anything? (optional)</p>
        </div>

        <InterventionSuggestions
          severity={severity}
          eventId={eventId ?? undefined}
          onLog={logIntervention}
        />

        <div className="space-y-2">
          <p className="text-xs text-slate-500 uppercase tracking-wide">All options</p>
          <div className="flex flex-wrap gap-2">
            {INTERVENTION_TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => logIntervention(t.value)}
                className="px-4 py-2.5 rounded-full text-sm font-medium bg-slate-800 border border-slate-600 text-slate-300 active:bg-slate-700"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => setStep('done')}
          className="text-slate-500 text-sm text-center py-3"
        >
          Skip
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 px-4 pt-6 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-100">How are you feeling?</h1>
        {event && (
          <p className="text-sm text-slate-400 mt-1">
            {event.direction === 'falling' ? 'Pressure dropping' : 'Pressure rising'} &middot;{' '}
            {event.forecasted_change_mbar} mbar
          </p>
        )}
      </div>

      {/* Severity */}
      <SeveritySlider value={severity} onChange={setSeverity} />

      {/* Symptoms */}
      <SymptomChips selected={symptoms} onChange={setSymptoms} />

      {/* Note */}
      <div className="space-y-2">
        <label className="text-sm text-slate-400 uppercase tracking-wide">Note (optional)</label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Any details…"
          rows={2}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 placeholder:text-slate-600 text-sm resize-none focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Retroactive time */}
      <div>
        <button
          type="button"
          onClick={() => setShowRetro(!showRetro)}
          className="text-slate-500 text-sm"
        >
          {showRetro ? 'Hide' : 'Logging for a different time?'}
        </button>
        {showRetro && (
          <input
            type="datetime-local"
            value={recordedAt}
            onChange={e => setRecordedAt(e.target.value)}
            className="mt-2 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
          />
        )}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {/* Submit */}
      <button
        onClick={submitCheckin}
        disabled={submitting}
        className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-lg font-semibold py-4 rounded-xl transition-colors"
      >
        {submitting ? 'Saving…' : 'Save Check-in'}
      </button>
    </div>
  )
}

export default function CheckinPage() {
  return (
    <Suspense>
      <CheckinForm />
    </Suspense>
  )
}
