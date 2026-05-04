import type { PressureEvent, PromptType } from './types'

const PROMPT_LABELS: Record<PromptType, string> = {
  start: 'Starting now',
  midpoint: 'Midpoint reached',
  peak: 'Peak expected now',
  manual: 'Check in',
}

function formatDirection(direction: string): string {
  return direction === 'falling' ? 'dropping' : 'rising'
}

export async function sendEventNotification(
  event: PressureEvent,
  promptType: PromptType,
  appUrl: string,
  webhookUrl: string
): Promise<void> {
  const label = PROMPT_LABELS[promptType]
  const checkinUrl = `${appUrl}/checkin?event_id=${event.id}&prompt=${promptType}`

  const rate = event.rate_mbar_hr?.toFixed(2) ?? '—'
  const change = event.forecasted_change_mbar
  const direction = formatDirection(event.direction)
  const hours = event.forecasted_duration_hrs

  const body = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `Pressure ${direction} — ${label}`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${change} mbar* ${direction} over *${hours} hrs* (${rate} mbar/hr)\nHow are you feeling?`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Log Check-in' },
            url: checkinUrl,
            style: 'primary',
          },
        ],
      },
    ],
  }

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new Error(`Slack webhook failed: ${res.status}`)
  }
}

export async function sendTestNotification(webhookUrl: string, appUrl: string): Promise<void> {
  const body = {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Pressure Tracker connected successfully.*\nThis is a test notification. <${appUrl}|Open app>`,
        },
      },
    ],
  }

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error(`Slack webhook failed: ${res.status}`)
}
