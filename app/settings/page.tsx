'use client'

import { useState, useEffect } from 'react'
import Nav from '@/components/Nav'
import type { Settings } from '@/lib/types'

const FIELDS: { key: keyof Settings; label: string; type: string; placeholder: string }[] = [
  { key: 'location_label', label: 'Location Name', type: 'text', placeholder: 'Kingston, OK' },
  { key: 'location_lat', label: 'Latitude', type: 'number', placeholder: '34.2334' },
  { key: 'location_lng', label: 'Longitude', type: 'number', placeholder: '-96.7167' },
  { key: 'alert_threshold_mbar', label: 'Alert Threshold (mbar)', type: 'number', placeholder: '6' },
  { key: 'alert_threshold_hours', label: 'Alert Window (hours)', type: 'number', placeholder: '3' },
  { key: 'slack_webhook_url', label: 'Slack Webhook URL', type: 'url', placeholder: 'https://hooks.slack.com/services/...' },
]

export default function SettingsPage() {
  const [values, setValues] = useState<Partial<Settings>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        setValues(data)
        setLoading(false)
      })
  }, [])

  async function save() {
    setSaving(true)
    setSaved(false)
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function testSlack() {
    setTesting(true)
    setTestResult(null)
    const appUrl = window.location.origin
    const webhookUrl = values.slack_webhook_url
    if (!webhookUrl) {
      setTestResult('fail')
      setTesting(false)
      return
    }
    try {
      const res = await fetch('/api/settings/test-slack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl, appUrl }),
      })
      setTestResult(res.ok ? 'ok' : 'fail')
    } catch {
      setTestResult('fail')
    }
    setTesting(false)
  }

  if (loading) {
    return (
      <main className="flex-1 px-4 pt-6 pb-24">
        <h1 className="text-xl font-bold mb-6">Settings</h1>
        <div className="space-y-4">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 bg-slate-800 rounded-lg animate-pulse" />
          ))}
        </div>
        <Nav />
      </main>
    )
  }

  return (
    <main className="flex-1 px-4 pt-6 pb-24">
      <h1 className="text-xl font-bold mb-6">Settings</h1>

      <div className="space-y-5">
        {FIELDS.map(field => (
          <div key={field.key} className="space-y-1.5">
            <label className="text-sm text-slate-400">{field.label}</label>
            <div className="flex gap-2">
              <input
                type={field.type}
                value={(values[field.key] as string) ?? ''}
                onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-3 text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
              />
              {field.key === 'slack_webhook_url' && (
                <button
                  type="button"
                  onClick={testSlack}
                  disabled={testing}
                  className="px-3 py-2 bg-slate-700 text-slate-300 text-sm rounded-lg disabled:opacity-50"
                >
                  {testing ? '…' : 'Test'}
                </button>
              )}
            </div>
            {field.key === 'slack_webhook_url' && testResult && (
              <p className={`text-xs ${testResult === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
                {testResult === 'ok' ? 'Message sent successfully' : 'Failed — check the URL'}
              </p>
            )}
          </div>
        ))}

        <div className="pt-2">
          <button
            onClick={save}
            disabled={saving}
            className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-semibold py-4 rounded-xl text-lg transition-colors"
          >
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save Settings'}
          </button>
        </div>

        {/* Export */}
        <div className="border-t border-slate-700 pt-5">
          <h2 className="text-sm text-slate-400 mb-3">Data</h2>
          <a
            href="/api/export"
            className="block w-full text-center bg-slate-800 border border-slate-700 text-slate-300 font-medium py-3 rounded-xl"
          >
            Export All Data (CSV)
          </a>
        </div>
      </div>

      <Nav />
    </main>
  )
}
