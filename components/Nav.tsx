'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/', label: 'Home', icon: '⌂' },
  { href: '/events', label: 'Events', icon: '◎' },
  { href: '/analysis', label: 'Analysis', icon: '▦' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
]

export default function Nav() {
  const path = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 z-50">
      <div className="mx-auto max-w-lg flex">
        {tabs.map(tab => {
          const active = tab.href === '/' ? path === '/' : path.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center justify-center py-3 text-xs gap-1 transition-colors ${
                active ? 'text-indigo-400' : 'text-slate-400'
              }`}
            >
              <span className="text-lg leading-none">{tab.icon}</span>
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
