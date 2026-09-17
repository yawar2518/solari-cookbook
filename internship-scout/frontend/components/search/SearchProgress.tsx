'use client'

import { useEffect, useState } from 'react'
import { Check, Globe, ListChecks, Radar, Sparkles } from 'lucide-react'
import { ProgressBar } from '@/components/ui/States'
import { SEARCH_MESSAGES, ThinkingLine } from '@/components/ui/Thinking'
import type { SearchRun } from '@/lib/types'
import { cn } from '@/lib/utils'

const STAGES = [
  { key: 'queued', label: 'Queued', icon: ListChecks, at: 0 },
  { key: 'scraping', label: 'Reading live listings', icon: Globe, at: 8 },
  { key: 'matching', label: 'Ranking by fit', icon: Radar, at: 60 },
  { key: 'done', label: 'Ready', icon: Sparkles, at: 100 },
]

export function SearchProgress({ run, keywords, location }: { run: SearchRun | null; keywords: string[]; location: string }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const progress = run?.progress ?? 2
  const status = run?.status ?? 'queued'
  const activeIdx = STAGES.findIndex((s) => s.key === status)

  return (
    <div className="fade-up mx-auto max-w-3xl">
      <div className="mb-6 text-center">
        <div className="eyebrow text-accent">Step 3 of 3</div>
        <h1 className="mt-2 text-3xl font-bold">Searching live listings for you.</h1>
        <p className="mt-2 text-muted">
          {run?.cache_hit ? 'We found fresh results from the last few hours — ranking them now.' : 'A stealth browser is reading job boards in real time. This usually takes about a minute.'}
        </p>
      </div>

      <div className="card p-6 sm:p-8">
        <div className="mb-6 flex flex-wrap gap-1.5">
          {keywords.map((k) => (
            <span key={k} className="pill pill-primary">
              {k}
            </span>
          ))}
          {location && <span className="pill pill-muted">{location}</span>}
        </div>

        <ol className="grid gap-3 sm:grid-cols-4">
          {STAGES.map(({ key, label, icon: Icon }, i) => {
            const done = i < activeIdx || status === 'done'
            const active = i === activeIdx && status !== 'done'
            return (
              <li key={key} className={cn('surface flex items-center gap-3 p-3 transition', active && 'border-primary/60 shadow-glow', done && 'border-accent/30')}>
                <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', done ? 'bg-accent-soft text-accent' : active ? 'bg-primary-soft text-sky' : 'bg-surface-2 text-dim')}>
                  {done ? <Check size={15} /> : <Icon size={15} className={active ? 'animate-pulse' : ''} />}
                </span>
                <span className={cn('text-xs font-medium', done || active ? 'text-ink' : 'text-dim')}>{label}</span>
              </li>
            )
          })}
        </ol>

        <div className="mt-6">
          <ProgressBar value={progress} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <ThinkingLine messages={SEARCH_MESSAGES} progress={progress} />
            <span className="text-xs tabular-nums text-dim">
              {run?.stage ? `${run.stage} · ` : ''}
              {elapsed}s
            </span>
          </div>
        </div>

        <div className="mt-6 grid gap-2 text-[12px] text-dim sm:grid-cols-3">
          <div className="surface p-3">Listings are from the last 24 hours across LinkedIn, Internshala and Rozee.</div>
          <div className="surface p-3">Results are cached for 6 hours — a repeat search with the same keywords is instant.</div>
          <div className="surface p-3">You can leave this page; the search keeps running and shows up on your dashboard.</div>
        </div>
      </div>
    </div>
  )
}
