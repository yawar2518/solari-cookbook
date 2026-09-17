'use client'

import Link from 'next/link'
import { FileText, Search } from 'lucide-react'
import { useUser } from '@/components/providers/UserProvider'
import { cn } from '@/lib/utils'

/** Always-visible credit balance in the header. */
export function CreditPill() {
  const { me, loading } = useUser()
  if (loading && !me) return <div className="skeleton h-8 w-28" />
  if (!me) return null
  const { usage } = me

  if (usage.plan === 'pro') {
    return (
      <div className="hidden items-center gap-1.5 rounded-full border border-accent/25 bg-accent-soft px-3 py-1 text-xs font-medium text-accent sm:flex" title="Unlimited on Pro">
        Unlimited
      </div>
    )
  }

  const s = usage.searches
  const c = usage.cover_letters
  const sLeft = Math.min(s.remaining_today ?? 0, s.balance ?? 0)
  const cLeft = Math.min(c.remaining_today ?? 0, c.balance ?? 0)

  return (
    <Link
      href="/pricing"
      className="flex items-center gap-2 rounded-full border border-line-soft bg-surface/70 px-2.5 py-1 text-xs font-medium text-ink-2 transition hover:border-primary/50"
      title={`Searches: ${s.remaining_today} left today (${s.balance} credits). Cover letters: ${c.remaining_today} left today (${c.balance} credits).`}
    >
      <span className={cn('flex items-center gap-1', sLeft === 0 && 'text-warning')}>
        <Search size={12} className="text-sky" /> {sLeft}
      </span>
      <span className="h-3 w-px bg-line" />
      <span className={cn('flex items-center gap-1', cLeft === 0 && 'text-warning')}>
        <FileText size={12} className="text-accent" /> {cLeft}
      </span>
    </Link>
  )
}
