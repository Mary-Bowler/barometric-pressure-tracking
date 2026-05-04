import type { SuggestionResult, InterventionType } from './types'
import { createServerClient } from './supabase'

export async function getSuggestions(currentSeverity: number): Promise<SuggestionResult[]> {
  const db = createServerClient()
  const severityMin = Math.max(0, currentSeverity - 2)
  const severityMax = Math.min(10, currentSeverity + 2)

  // Find checkins in the severity range, join to their interventions
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
    .neq('source', 'benadryl_gcal')

  if (error || !data) return []

  // Filter to interventions linked to checkins in severity range
  const filtered = data.filter((row: any) => {
    const severity = row.symptom_checkins?.severity
    return severity != null && severity >= severityMin && severity <= severityMax
  })

  // Group by type, average effectiveness
  const byType = new Map<InterventionType, { total: number; count: number }>()
  for (const row of filtered) {
    const type = row.type as InterventionType
    const eff = row.perceived_effectiveness as number
    const existing = byType.get(type) ?? { total: 0, count: 0 }
    byType.set(type, { total: existing.total + eff, count: existing.count + 1 })
  }

  const results: SuggestionResult[] = Array.from(byType.entries())
    .map(([type, { total, count }]) => ({
      type,
      avg_effectiveness: Math.round((total / count) * 10) / 10,
      sample_count: count,
    }))
    .sort((a, b) => b.avg_effectiveness - a.avg_effectiveness)
    .slice(0, 3)

  return results
}
