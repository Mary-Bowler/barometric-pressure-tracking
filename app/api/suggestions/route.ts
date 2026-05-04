import { NextRequest, NextResponse } from 'next/server'
import { getSuggestions } from '@/lib/suggestions'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const severity = parseInt(searchParams.get('severity') ?? '5')

  if (isNaN(severity) || severity < 0 || severity > 10) {
    return NextResponse.json({ error: 'severity must be 0–10' }, { status: 400 })
  }

  const suggestions = await getSuggestions(severity)
  return NextResponse.json(suggestions)
}
