'use client'

interface Props {
  value: number
  onChange: (v: number) => void
}

function severityColor(v: number): string {
  if (v <= 3) return '#22c55e'   // green
  if (v <= 6) return '#eab308'   // yellow
  return '#ef4444'                // red
}

function severityLabel(v: number): string {
  if (v === 0) return 'None'
  if (v <= 2) return 'Mild'
  if (v <= 4) return 'Noticeable'
  if (v <= 6) return 'Moderate'
  if (v <= 8) return 'Severe'
  return 'Debilitating'
}

export default function SeveritySlider({ value, onChange }: Props) {
  const color = severityColor(value)

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <label className="text-sm text-slate-400 uppercase tracking-wide">Severity</label>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold" style={{ color }}>{value}</span>
          <span className="text-slate-400 text-sm">{severityLabel(value)}</span>
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={10}
        step={1}
        value={value}
        onChange={e => onChange(parseInt(e.target.value))}
        className="w-full cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${color} 0%, ${color} ${value * 10}%, #334155 ${value * 10}%, #334155 100%)`,
        }}
      />
      <div className="flex justify-between text-xs text-slate-500">
        <span>0</span>
        <span>5</span>
        <span>10</span>
      </div>
    </div>
  )
}
