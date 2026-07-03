import type { DetectedPressureEvent } from './types'

interface OpenMeteoResponse {
  hourly: {
    time: number[]
    surface_pressure: number[]
  }
}

export async function fetchPressureForecast(lat: number, lng: number): Promise<{ time: string; pressure: number }[]> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', lat.toString())
  url.searchParams.set('longitude', lng.toString())
  url.searchParams.set('hourly', 'surface_pressure')
  url.searchParams.set('forecast_days', '2')
  // Unix timestamps are unambiguous UTC instants; naive local-time strings
  // would be parsed in the server's timezone and skew every stored timestamp
  // (and thus notification timing) by the location's UTC offset.
  url.searchParams.set('timeformat', 'unixtime')
  url.searchParams.set('timezone', 'UTC')

  const res = await fetch(url.toString(), { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`)

  const data: OpenMeteoResponse = await res.json()

  return data.hourly.time.map((t, i) => ({
    time: new Date(t * 1000).toISOString(),
    pressure: data.hourly.surface_pressure[i],
  }))
}

export function detectPressureEvent(
  readings: { time: string; pressure: number }[],
  thresholdMbar: number,
  thresholdHours: number
): DetectedPressureEvent | null {
  // Only look at future readings (starting from the current hour)
  const currentHourMs = Math.floor(Date.now() / 3_600_000) * 3_600_000
  const upcoming = readings.filter(r => new Date(r.time).getTime() >= currentHourMs)

  if (upcoming.length < 2) return null

  // Readings are hourly, so a span of N steps covers N hours. Compare every
  // pair of readings up to thresholdHours apart, not just window endpoints,
  // so a fast swing inside the window still triggers.
  const maxSteps = Math.max(1, Math.floor(thresholdHours))

  for (let i = 0; i < upcoming.length - 1; i++) {
    const last = Math.min(i + maxSteps, upcoming.length - 1)
    for (let j = i + 1; j <= last; j++) {
      if (Math.abs(upcoming[j].pressure - upcoming[i].pressure) < thresholdMbar) continue

      // Trim readings that don't contribute to the change (e.g. a flat
      // lead-in before a sharp drop), otherwise the stored duration is
      // inflated and rate_mbar_hr — the core analysis variable — diluted.
      while (i + 1 < j && Math.abs(upcoming[j].pressure - upcoming[i + 1].pressure) >= thresholdMbar) i++
      while (j - 1 > i && Math.abs(upcoming[j - 1].pressure - upcoming[i].pressure) >= thresholdMbar) j--

      const start = upcoming[i]
      const end = upcoming[j]
      const delta = end.pressure - start.pressure
      const durationHrs = (new Date(end.time).getTime() - new Date(start.time).getTime()) / 3_600_000

      return {
        direction: delta < 0 ? 'falling' : 'rising',
        forecasted_change_mbar: Math.round(Math.abs(delta) * 100) / 100,
        forecasted_duration_hrs: Math.round(durationHrs * 100) / 100,
        event_start: start.time,
        event_end: end.time,
        actual_pressure_start: start.pressure,
      }
    }
  }

  return null
}

export async function getCurrentPressure(lat: number, lng: number): Promise<number | null> {
  try {
    const readings = await fetchPressureForecast(lat, lng)
    const currentHourMs = Math.floor(Date.now() / 3_600_000) * 3_600_000

    const match = readings.find(r => {
      const t = new Date(r.time).getTime()
      return t >= currentHourMs && t < currentHourMs + 3_600_000
    })

    // No wrong-hour fallback: a stale reading is worse than showing nothing
    return match?.pressure ?? null
  } catch {
    return null
  }
}
