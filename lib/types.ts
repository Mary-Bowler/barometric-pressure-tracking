export type Direction = 'rising' | 'falling'
export type EventStatus = 'active' | 'completed'
export type EventSource = 'auto' | 'manual'
export type EntryMethod = 'pwa' | 'slack'
export type PromptType = 'start' | 'midpoint' | 'peak' | 'manual'
export type InterventionType = 'movement' | 'rest' | 'benadryl' | 'hydration' | 'other'
export type InterventionSource = 'manual' | 'benadryl_gcal'

export type SymptomType = 'head_pressure' | 'migraine' | 'fatigue' | 'cognitive' | 'other'

export interface PressureEvent {
  id: string
  created_at: string
  event_start: string
  event_end: string | null
  direction: Direction
  forecasted_change_mbar: number
  forecasted_duration_hrs: number
  rate_mbar_hr: number
  first_intervention_at: string | null
  actual_pressure_start: number | null
  actual_pressure_end: number | null
  source: EventSource
  notes: string | null
  status: EventStatus
  midpoint_due_at: string | null
  peak_due_at: string | null
  midpoint_notified_at: string | null
  peak_notified_at: string | null
}

export interface SymptomCheckin {
  id: string
  created_at: string
  event_id: string | null
  recorded_at: string
  entry_method: EntryMethod
  severity: number
  symptom_types: SymptomType[]
  note: string | null
  prompt_type: PromptType | null
}

export interface Intervention {
  id: string
  created_at: string
  event_id: string | null
  checkin_id: string | null
  recorded_at: string
  type: InterventionType
  perceived_effectiveness: number | null
  source: InterventionSource
  notes: string | null
}

export interface Setting {
  key: string
  value: string
  updated_at: string
}

export interface Settings {
  location_lat: string
  location_lng: string
  location_label: string
  alert_threshold_mbar: string
  alert_threshold_hours: string
  slack_webhook_url: string
}

export interface EventOutcome {
  id: string
  event_start: string
  direction: Direction
  forecasted_change_mbar: number
  forecasted_duration_hrs: number
  rate_mbar_hr: number
  peak_severity: number | null
  avg_severity: number | null
  checkin_count: number
  hours_to_first_intervention: number | null
}

export interface DetectedPressureEvent {
  direction: Direction
  forecasted_change_mbar: number
  forecasted_duration_hrs: number
  event_start: string
  event_end: string
  actual_pressure_start: number
}

export interface SuggestionResult {
  type: InterventionType
  avg_effectiveness: number
  sample_count: number
}
