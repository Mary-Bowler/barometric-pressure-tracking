'use client'

import { useEffect, useState } from 'react'

type Mode = 'datetime' | 'date' | 'time'

interface Props {
  iso: string
  mode?: Mode
  className?: string
}

function format(iso: string, mode: Mode, timeZone?: string): string {
  const d = new Date(iso)
  if (mode === 'time') {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone })
  }
  if (mode === 'date') {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone })
  }
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone,
  })
}

// Timestamps are stored as UTC instants and the server can't know the
// viewer's timezone. Pre-mount renders explicit UTC — identical on server
// and during hydration, so no mismatch — then the mounted flip forces a
// real re-render in the browser's local timezone. (A useState initializer
// that formats local time does NOT work: concurrent React keeps the
// server-rendered text on suppressed mismatches and the identical-state
// setText bails out, leaving UTC in the DOM forever.)
export default function LocalTime({ iso, mode = 'datetime', className }: Props) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const text = mounted ? format(iso, mode) : format(iso, mode, 'UTC')

  return (
    <time dateTime={iso} suppressHydrationWarning className={className}>
      {text}
    </time>
  )
}
