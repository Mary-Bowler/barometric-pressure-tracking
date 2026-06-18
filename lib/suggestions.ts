import type { SupabaseClient } from '@supabase/supabase-js'
import type { SuggestionResult, InterventionType } from './types'

export async function getSuggestions(
  db: SupabaseClient,
  currentSeverity: number
): Promise<SuggestionResult[]> {
  const severityMin = Math.max(0, currentSeverity - 2)
  const severityMax = Math.min(10, currentSeverity + 2)

  const { data, error } = await db
    .from('interventions')
    .select(`
      type,
      perceived_effectiveness,
      checkin_id,
      symptom_checkins!interventions_checkin_id_fkey (
        severity
      )
    `)
    .not('perceived_effectiveness', 'is', null)

  if (error || !data) return []

  const filtered = data.filter((row: any) => {
    const severity = row.symptom_checkins?.severity
    return severity != null && severity >= severityMin && severity <= severityMax
  })

  const byType = new Map<InterventionType, { total: number; count: number }>()
  for (const row of filtered) {
    const type = row.type as InterventionType
    const eff = row.perceived_effectiveness as number
    const existing = byType.get(type) ?? { total: 0, count: 0 }
    byType.set(type, { total: existing.total + eff, count: existing.count + 1 })
  }

  return Array.from(byType.entries())
    .map(([type, { total, count }]) => ({
      type,
      avg_effectiveness: Math.round((total / count) * 10) / 10,
      sample_count: count,
    }))
    .sort((a, b) => b.avg_effectiveness - a.avg_effectiveness)
    .slice(0, 3)
}
