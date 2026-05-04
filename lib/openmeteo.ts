import type { DetectedPressureEvent } from './types'

interface OpenMeteoResponse {
  hourly: {
    time: string[]
    surface_pressure: number[]
  }
}

export async function fetchPressureForecast(lat: number, lng: number): Promise<{ time: string; pressure: number }[]> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', lat.toString())
  url.searchParams.set('longitude', lng.toString())
  url.searchParams.set('hourly', 'surface_pressure')
  url.searchParams.set('forecast_days', '2')
  url.searchParams.set('timezone', 'America/Chicago')

  const res = await fetch(url.toString(), { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`)

  const data: OpenMeteoResponse = await res.json()

  return data.hourly.time.map((t, i) => ({
    time: t,
    pressure: data.hourly.surface_pressure[i],
  }))
}

export function detectPressureEvent(
  readings: { time: string; pressure: number }[],
  thresholdMbar: number,
  thresholdHours: number
): DetectedPressureEvent | null {
  const now = new Date()

  // Only look at future readings (starting from the current hour)
  const upcoming = readings.filter(r => new Date(r.time) >= new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()))

  if (upcoming.length < 2) return null

  // Slide a window of thresholdHours across the upcoming readings
  const windowSize = Math.ceil(thresholdHours)

  for (let i = 0; i <= upcoming.length - windowSize; i++) {
    const windowStart = upcoming[i]
    const windowEnd = upcoming[i + windowSize - 1]

    const delta = windowEnd.pressure - windowStart.pressure
    const absDelta = Math.abs(delta)
    const durationHrs = (new Date(windowEnd.time).getTime() - new Date(windowStart.time).getTime()) / 3_600_000

    if (absDelta >= thresholdMbar) {
      return {
        direction: delta < 0 ? 'falling' : 'rising',
        forecasted_change_mbar: Math.round(absDelta * 100) / 100,
        forecasted_duration_hrs: Math.round(durationHrs * 100) / 100,
        event_start: windowStart.time,
        event_end: windowEnd.time,
        actual_pressure_start: windowStart.pressure,
      }
    }
  }

  return null
}

export async function getCurrentPressure(lat: number, lng: number): Promise<number | null> {
  try {
    const readings = await fetchPressureForecast(lat, lng)
    const now = new Date()
    const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours())

    const match = readings.find(r => {
      const t = new Date(r.time)
      return t >= currentHour && t < new Date(currentHour.getTime() + 3_600_000)
    })

    return match?.pressure ?? readings[0]?.pressure ?? null
  } catch {
    return null
  }
}
