'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Bookmark, FileText, LayoutDashboard, LogOut, Menu, Search, ShieldCheck, Sparkles, X } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { useUser } from '@/components/providers/UserProvider'
import { cn, initials } from '@/lib/utils'
import { CreditPill } from './CreditPill'
import { FeedbackWidget } from './FeedbackWidget'

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/search', label: 'Find matches', icon: Search },
  { href: '/saved', label: 'Saved jobs', icon: Bookmark },
  { href: '/cv', label: 'CV studio', icon: FileText },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { me } = useUser()
  const [open, setOpen] = useState(false)

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')
  const user = me?.user

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setOpen(false)}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
            isActive(href) ? 'bg-primary-soft text-ink' : 'text-muted hover:bg-surface-2 hover:text-ink',
          )}
        >
          <Icon size={17} className={isActive(href) ? 'text-accent' : ''} />
          {label}
        </Link>
      ))}
      {user?.is_admin && (
        <Link
          href="/admin"
          onClick={() => setOpen(false)}
          className={cn(
            'mt-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
            isActive('/admin') ? 'bg-primary-soft text-ink' : 'text-muted hover:bg-surface-2 hover:text-ink',
          )}
        >
          <ShieldCheck size={17} className={isActive('/admin') ? 'text-accent' : ''} />
          Admin
        </Link>
      )}
    </nav>
  )

  return (
    <div className="min-h-screen bg-aurora">
      <header className="sticky top-0 z-40 border-b border-line-soft bg-base/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4 sm:px-6">
          <button className="rounded-md p-1.5 text-muted hover:text-ink lg:hidden" onClick={() => setOpen((o) => !o)} aria-label="Toggle navigation">
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
          <Logo href="/dashboard" />
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <CreditPill />
            {user?.plan === 'free' ? (
              <Link href="/pricing" className="btn btn-accent hidden h-8 px-3 text-xs sm:inline-flex">
                <Sparkles size={13} /> Go Pro
              </Link>
            ) : (
              <span className="pill pill-accent hidden sm:inline-flex">PRO</span>
            )}
            <div className="flex items-center gap-2 border-l border-line-soft pl-2 sm:pl-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-3 text-[11px] font-semibold text-ink" title={user?.email}>
                {initials(user?.full_name, user?.email)}
              </div>
              <form action="/auth/signout" method="post">
                <button className="rounded-md p-1.5 text-muted transition hover:bg-surface-2 hover:text-ink" title="Sign out" aria-label="Sign out">
                  <LogOut size={16} />
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px] gap-6 px-4 py-6 sm:px-6">
        <aside className="hidden w-52 shrink-0 lg:block">
          <div className="sticky top-20">{nav}</div>
        </aside>

        {open && (
          <div className="fixed inset-0 z-30 bg-base/70 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)}>
            <div className="h-full w-64 border-r border-line-soft bg-surface p-4 pt-20" onClick={(e) => e.stopPropagation()}>
              {nav}
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <FeedbackWidget />
    </div>
  )
}
