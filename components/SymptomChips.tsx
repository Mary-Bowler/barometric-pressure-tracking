'use client'

import type { SymptomType } from '@/lib/types'

const SYMPTOMS: { value: SymptomType; label: string }[] = [
  { value: 'head_pressure', label: 'Head Pressure' },
  { value: 'migraine', label: 'Migraine' },
  { value: 'fatigue', label: 'Fatigue' },
  { value: 'cognitive', label: 'Brain Fog' },
  { value: 'other', label: 'Other' },
]

interface Props {
  selected: SymptomType[]
  onChange: (v: SymptomType[]) => void
}

export default function SymptomChips({ selected, onChange }: Props) {
  function toggle(sym: SymptomType) {
    if (selected.includes(sym)) {
      onChange(selected.filter(s => s !== sym))
    } else {
      onChange([...selected, sym])
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-sm text-slate-400 uppercase tracking-wide">Symptoms</label>
      <div className="flex flex-wrap gap-2">
        {SYMPTOMS.map(sym => {
          const active = selected.includes(sym.value)
          return (
            <button
              key={sym.value}
              type="button"
              onClick={() => toggle(sym.value)}
              className={`px-4 py-2.5 rounded-full text-sm font-medium border transition-colors ${
                active
                  ? 'bg-indigo-500 border-indigo-400 text-white'
                  : 'bg-slate-800 border-slate-600 text-slate-300 active:bg-slate-700'
              }`}
            >
              {sym.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
