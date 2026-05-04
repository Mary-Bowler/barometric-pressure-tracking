'use client'

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  Legend,
} from 'recharts'
import type { EventOutcome } from '@/lib/types'

interface Props {
  outcomes: EventOutcome[]
}

export default function CorrelationCharts({ outcomes }: Props) {
  // Rate vs severity scatter
  const rateData = outcomes
    .filter(o => o.rate_mbar_hr != null && o.peak_severity != null)
    .map(o => ({
      rate: parseFloat(o.rate_mbar_hr?.toString() ?? '0'),
      severity: o.peak_severity,
      direction: o.direction,
    }))

  const rising = rateData.filter(d => d.direction === 'rising')
  const falling = rateData.filter(d => d.direction === 'falling')

  // Magnitude vs severity scatter
  const magData = outcomes
    .filter(o => o.peak_severity != null)
    .map(o => ({
      magnitude: o.forecasted_change_mbar,
      severity: o.peak_severity,
      direction: o.direction,
    }))

  // Direction bar chart
  const directionBars = [
    {
      name: 'Rising',
      avg: rising.length > 0
        ? parseFloat((rising.reduce((s, d) => s + (d.severity ?? 0), 0) / rising.length).toFixed(1))
        : 0,
      n: rising.length,
    },
    {
      name: 'Falling',
      avg: falling.length > 0
        ? parseFloat((falling.reduce((s, d) => s + (d.severity ?? 0), 0) / falling.length).toFixed(1))
        : 0,
      n: falling.length,
    },
  ]

  return (
    <div className="space-y-8">
      {/* Rate vs Peak Severity */}
      <section>
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Rate (mbar/hr) vs Peak Severity</h2>
        <ResponsiveContainer width="100%" height={220}>
          <ScatterChart margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="rate"
              type="number"
              name="Rate"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              label={{ value: 'mbar/hr', position: 'insideBottom', offset: -2, fill: '#64748b', fontSize: 10 }}
            />
            <YAxis
              dataKey="severity"
              type="number"
              name="Severity"
              domain={[0, 10]}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
              labelStyle={{ color: '#94a3b8' }}
            />
            <Scatter name="Rising" data={rising} fill="#60a5fa" />
            <Scatter name="Falling" data={falling} fill="#fb923c" />
            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
          </ScatterChart>
        </ResponsiveContainer>
      </section>

      {/* Direction bar */}
      <section>
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Average Peak Severity by Direction</h2>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={directionBars} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <YAxis domain={[0, 10]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
            />
            <Bar dataKey="avg" name="Avg Severity" radius={[4, 4, 0, 0]}>
              <Cell fill="#60a5fa" />
              <Cell fill="#fb923c" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-2 text-xs text-slate-500">
          <span>Rising: {rising.length} events</span>
          <span>Falling: {falling.length} events</span>
        </div>
      </section>

      {/* Magnitude vs severity */}
      <section>
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Magnitude (mbar) vs Peak Severity</h2>
        <ResponsiveContainer width="100%" height={220}>
          <ScatterChart margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="magnitude"
              type="number"
              name="Change"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              label={{ value: 'mbar total', position: 'insideBottom', offset: -2, fill: '#64748b', fontSize: 10 }}
            />
            <YAxis
              dataKey="severity"
              type="number"
              name="Severity"
              domain={[0, 10]}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
            />
            <Scatter
              data={magData}
              fill="#818cf8"
            />
          </ScatterChart>
        </ResponsiveContainer>
      </section>
    </div>
  )
}
