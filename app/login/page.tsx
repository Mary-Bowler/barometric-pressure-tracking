'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      },
    })
    setLoading(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-1 text-slate-100">Pressure Tracker</h1>
        <p className="text-slate-400 mb-8 text-sm">Sign in with a magic link — no password needed.</p>

        {sent ? (
          <div className="rounded-xl bg-slate-800 border border-slate-700 p-5">
            <p className="text-slate-300 text-sm">
              Check your email — we sent a sign-in link to <strong className="text-slate-100">{email}</strong>.
            </p>
            <p className="text-slate-500 text-xs mt-2">
              On iPhone, open the link in Safari for best results.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              required
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3.5 text-slate-100 placeholder:text-slate-600 text-base focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 py-3.5 text-white font-semibold text-base transition-colors"
            >
              {loading ? 'Sending…' : 'Send magic link'}
            </button>
            {error && <p className="text-red-400 text-sm">{error}</p>}
          </form>
        )}
      </div>
    </main>
  )
}
