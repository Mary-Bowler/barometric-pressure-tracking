import { NextRequest, NextResponse } from 'next/server'
import { sendTestNotification } from '@/lib/slack'

export async function POST(req: NextRequest) {
  const { webhookUrl, appUrl } = await req.json()
  if (!webhookUrl) return NextResponse.json({ error: 'webhookUrl required' }, { status: 400 })

  try {
    await sendTestNotification(webhookUrl, appUrl)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
