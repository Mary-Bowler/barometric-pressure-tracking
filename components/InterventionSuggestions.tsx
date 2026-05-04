'use client'

import { useEffect, useState } from 'react'
import type { SuggestionResult, InterventionType } from '@/lib/types'

const TYPE_LABELS: Record<InterventionType, string> = {
  movement: 'Movement',
  rest: 'Rest',
  benadryl: 'Benadryl',
  hydration: 'Hydration',
  other: 'Other',
}

const TYPE_ICONS: Record<InterventionType, string> = {
  movement: '🚶',
  rest: '🛌',
  benadryl: '💊',
  hydration: '💧',
  other: '✦',
}

interface Props {
  severity: number
  eventId?: string
  onLog: (type: InterventionType) => void
}

export default function InterventionSuggestions({ severity, eventId, onLog }: Props) {
  const [suggestions, setSuggestions] = useState<SuggestionResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/suggestions?severity=${severity}`)
      .then(r => r.json())
      .then(data => {
        setSuggestions(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [severity])

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-14 bg-slate-800 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (suggestions.length === 0) {
    return (
      <p className="text-slate-500 text-sm text-center py-4">
        No history yet — all interventions available below
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 uppercase tracking-wide">Based on similar episodes</p>
      {suggestions.map(s => (
        <button
          key={s.type}
          type="button"
          onClick={() => onLog(s.type)}
          className="w-full flex items-center justify-between bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg px-4 py-3 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">{TYPE_ICONS[s.type]}</span>
            <div className="text-left">
              <p className="text-sm font-medium text-slate-100">{TYPE_LABELS[s.type]}</p>
              <p className="text-xs text-slate-500">{s.sample_count} past uses</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-indigo-300">{s.avg_effectiveness}/10</p>
            <p className="text-xs text-slate-500">avg effect</p>
          </div>
        </button>
      ))}
    </div>
  )
}
