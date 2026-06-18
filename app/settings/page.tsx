'use client'

import { useState, useEffect } from 'react'
import Nav from '@/components/Nav'
import { enablePush } from '@/lib/push-client'
import type { UserSettings } from '@/lib/types'

type SettingsForm = {
  location_label: string
  location_lat: string
  location_lng: string
  alert_threshold_mbar: string
  alert_threshold_hours: string
}

const FIELDS: { key: keyof SettingsForm; label: string; type: string; placeholder: string }[] = [
  { key: 'location_label', label: 'Location Name', type: 'text', placeholder: 'Kingston, OK' },
  { key: 'location_lat', label: 'Latitude', type: 'number', placeholder: '34.2334' },
  { key: 'location_lng', label: 'Longitude', type: 'number', placeholder: '-96.7167' },
  { key: 'alert_threshold_mbar', label: 'Alert Threshold (mbar)', type: 'number', placeholder: '6' },
  { key: 'alert_threshold_hours', label: 'Alert Window (hours)', type: 'number', placeholder: '3' },
]

function toForm(s: UserSettings): SettingsForm {
  return {
    location_label: s.location_label ?? '',
    location_lat: String(s.location_lat ?? ''),
    location_lng: String(s.location_lng ?? ''),
    alert_threshold_mbar: String(s.alert_threshold_mbar ?? '6'),
    alert_threshold_hours: String(s.alert_threshold_hours ?? '3'),
  }
}

export default function SettingsPage() {
  const [values, setValues] = useState<Partial<SettingsForm>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [pushMsg, setPushMsg] = useState<string | null>(null)
  const [pushLoading, setPushLoading] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then((data: UserSettings) => {
        if (data && data.user_id) setValues(toForm(data))
        setLoading(false)
      })
      .catch(() => setLoading(false))
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

  async function onEnablePush() {
    setPushLoading(true)
    setPushMsg(null)
    const result = await enablePush()
    setPushMsg(result.ok ? 'Notifications enabled.' : result.reason ?? 'Failed.')
    setPushLoading(false)
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
            <input
              type={field.type}
              value={(values[field.key] as string) ?? ''}
              onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
              placeholder={field.placeholder}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-3 text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
            />
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

        {/* Push notifications */}
        <div className="border-t border-slate-700 pt-5 space-y-3">
          <h2 className="text-sm text-slate-400">Notifications</h2>
          <button
            onClick={onEnablePush}
            disabled={pushLoading}
            className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-medium py-3 rounded-xl transition-colors disabled:opacity-50"
          >
            {pushLoading ? 'Enabling…' : 'Enable notifications'}
          </button>
          {pushMsg && (
            <p className={`text-sm ${pushMsg.includes('enabled') ? 'text-green-400' : 'text-red-400'}`}>
              {pushMsg}
            </p>
          )}
          <p className="text-xs text-slate-500">
            On iPhone, add this app to your Home Screen first, then enable notifications.
          </p>
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
