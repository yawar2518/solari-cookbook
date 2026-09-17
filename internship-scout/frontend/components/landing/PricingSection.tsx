'use client'

import { useState } from 'react'
import { Check, Minus, Sparkles } from 'lucide-react'
import { WaitlistForm } from './WaitlistForm'
import { cn } from '@/lib/utils'

const FREE = [
  { text: '3 searches per day', ok: true },
  { text: '3 cover letters per day', ok: true },
  { text: '10 search + 3 cover letter credits at signup', ok: true },
  { text: 'Basic company info', ok: true },
  { text: 'CV upload + review', ok: true },
  { text: 'Job-tailored cover letters', ok: false },
  { text: 'Full company research', ok: false },
  { text: 'CV tailoring per job', ok: false },
]

const PRO = [
  'Unlimited searches',
  'Unlimited, fully tailored cover letters',
  'Full company research: size, stack, culture, Glassdoor',
  'CV tailoring suggestions for every job',
  'ATS-optimised CV rewrite',
  'Priority scraping queue',
]

export function PricingSection({ compact = false, currentPlan }: { compact?: boolean; currentPlan?: 'free' | 'pro' | null }) {
  const [yearly, setYearly] = useState(false)
  const price = yearly ? 'PKR 8,999' : 'PKR 999'
  const per = yearly ? '/year' : '/month'

  return (
    <div>
      <div className="mb-8 flex items-center justify-center gap-3">
        <span className={cn('text-sm', !yearly ? 'text-ink' : 'text-muted')}>Monthly</span>
        <button
          onClick={() => setYearly((y) => !y)}
          className={cn('relative h-6 w-11 rounded-full border transition', yearly ? 'border-accent/50 bg-accent/30' : 'border-line bg-surface-2')}
          aria-pressed={yearly}
          aria-label="Toggle yearly billing"
        >
          <span className={cn('absolute top-0.5 h-[18px] w-[18px] rounded-full bg-ink transition-all', yearly ? 'left-[22px]' : 'left-0.5')} />
        </button>
        <span className={cn('text-sm', yearly ? 'text-ink' : 'text-muted')}>
          Yearly <span className="pill pill-accent ml-1">save 25%</span>
        </span>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="card p-6 sm:p-7">
          <div className="eyebrow">Free</div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-display text-4xl font-bold text-ink">PKR 0</span>
            <span className="text-sm text-muted">forever</span>
          </div>
          <p className="mt-2 text-sm text-muted">Enough to find your first few real matches and apply.</p>
          <ul className="mt-6 space-y-2.5 text-sm">
            {FREE.map((f) => (
              <li key={f.text} className={cn('flex items-start gap-2.5', f.ok ? 'text-ink-2' : 'text-dim')}>
                {f.ok ? <Check size={16} className="mt-0.5 shrink-0 text-accent" /> : <Minus size={16} className="mt-0.5 shrink-0" />}
                {f.text}
              </li>
            ))}
          </ul>
          {currentPlan === 'free' ? (
            <div className="btn btn-ghost mt-7 w-full cursor-default">Your current plan</div>
          ) : (
            <a href="/auth?mode=signup" className="btn btn-ghost mt-7 w-full">
              Start free
            </a>
          )}
        </div>

        <div className="card relative overflow-hidden p-6 shadow-glow sm:p-7" style={{ borderColor: 'rgba(100,255,218,0.35)' }}>
          <div className="absolute right-4 top-4 pill pill-accent">
            <Sparkles size={12} /> Most popular
          </div>
          <div className="eyebrow text-accent">Pro</div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-display text-4xl font-bold text-ink">{price}</span>
            <span className="text-sm text-muted">{per}</span>
          </div>
          <p className="mt-2 text-sm text-muted">For people actively applying. Everything unlimited, everything tailored.</p>
          <ul className="mt-6 space-y-2.5 text-sm">
            {PRO.map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-ink-2">
                <Check size={16} className="mt-0.5 shrink-0 text-accent" />
                {t}
              </li>
            ))}
          </ul>
          <div className="mt-7">
            <button className="btn btn-accent w-full cursor-not-allowed opacity-80" disabled title="Payments launch soon">
              Coming soon
            </button>
            {!compact && (
              <div className="mt-4">
                <WaitlistForm plan={yearly ? 'pro_yearly' : 'pro_monthly'} />
              </div>
            )}
          </div>
        </div>
      </div>
      {compact && (
        <div className="mx-auto mt-6 max-w-md">
          <WaitlistForm plan={yearly ? 'pro_yearly' : 'pro_monthly'} />
        </div>
      )}
    </div>
  )
}
