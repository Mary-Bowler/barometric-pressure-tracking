'use client'

import { useEffect, useState } from 'react'

type Mode = 'datetime' | 'date' | 'time'

interface Props {
  iso: string
  mode?: Mode
  className?: string
}

function format(iso: string, mode: Mode): string {
  const d = new Date(iso)
  if (mode === 'time') {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }
  if (mode === 'date') {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

// Timestamps are stored as UTC instants; the server can't know the viewer's
// timezone, so the initial render (server tz) is corrected after mount.
export default function LocalTime({ iso, mode = 'datetime', className }: Props) {
  const [text, setText] = useState(() => format(iso, mode))

  useEffect(() => {
    setText(format(iso, mode))
  }, [iso, mode])

  return (
    <time dateTime={iso} suppressHydrationWarning className={className}>
      {text}
    </time>
  )
}
