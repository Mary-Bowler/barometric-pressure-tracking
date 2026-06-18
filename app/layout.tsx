import type { Metadata, Viewport } from 'next'
import './globals.css'
import { createClient } from '@/lib/supabase/server'
import { SignOutButton } from '@/components/SignOutButton'

export const metadata: Metadata = {
  title: 'Pressure Tracker',
  description: 'Barometric pressure symptom tracker',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Pressure',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0f172a',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="min-h-screen bg-slate-900 text-slate-100 antialiased">
        <div className="mx-auto max-w-lg min-h-screen flex flex-col">
          {user && (
            <header className="flex items-center justify-end px-4 pt-3 pb-0">
              <SignOutButton />
            </header>
          )}
          {children}
        </div>
      </body>
    </html>
  )
}
