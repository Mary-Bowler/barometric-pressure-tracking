import { createClient } from '@/lib/supabase/server'
import Nav from '@/components/Nav'
import CorrelationCharts from '@/components/CorrelationChart'
import type { EventOutcome } from '@/lib/types'

async function getOutcomes(): Promise<EventOutcome[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('event_outcomes')
    .select('*')
    .order('event_start', { ascending: false })
    .limit(200)
  return (data ?? []) as EventOutcome[]
}

export const revalidate = 0

export default async function AnalysisPage() {
  const outcomes = await getOutcomes()
  const withData = outcomes.filter(o => o.peak_severity != null)

  const avgRising =
    withData.filter(o => o.direction === 'rising').length > 0
      ? (
          withData
            .filter(o => o.direction === 'rising')
            .reduce((s, o) => s + (o.peak_severity ?? 0), 0) /
          withData.filter(o => o.direction === 'rising').length
        ).toFixed(1)
      : '—'

  const avgFalling =
    withData.filter(o => o.direction === 'falling').length > 0
      ? (
          withData
            .filter(o => o.direction === 'falling')
            .reduce((s, o) => s + (o.peak_severity ?? 0), 0) /
          withData.filter(o => o.direction === 'falling').length
        ).toFixed(1)
      : '—'

  return (
    <main className="flex-1 px-4 pt-6 pb-24">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Analysis</h1>
        <a href="/api/export" className="text-indigo-400 text-sm font-medium">
          Export CSV
        </a>
      </div>

      {outcomes.length < 3 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-6">
          <p className="text-slate-400 text-sm">
            Analysis improves with more data. Keep logging — patterns will appear here as events accumulate.
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-slate-800 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-slate-100">{outcomes.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Events</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-blue-300">{avgRising}</p>
          <p className="text-xs text-slate-500 mt-0.5">Avg ↑ severity</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-orange-300">{avgFalling}</p>
          <p className="text-xs text-slate-500 mt-0.5">Avg ↓ severity</p>
        </div>
      </div>

      {withData.length >= 2 && <CorrelationCharts outcomes={withData} />}

      <Nav />
    </main>
  )
}
