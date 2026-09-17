'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { CoverLetterModal } from '@/components/cover/CoverLetterModal'
import { EmptyState } from '@/components/ui/States'
import type { Job, ParsedProfile } from '@/lib/types'
import { cn } from '@/lib/utils'
import { JobCard } from './JobCard'
import { JobDetailPane } from './JobDetailPane'

type Filter = 'all' | 'Strong Match' | 'Good Match' | 'Partial Match'
type Sort = 'score' | 'recent'

export function ResultsWorkspace({
  jobs,
  profile,
  keywords,
  location,
  cacheHit,
  onToggleSave,
  onNewSearch,
  onEditProfile,
}: {
  jobs: Job[]
  profile: ParsedProfile | null
  keywords: string[]
  location: string
  cacheHit: boolean | null
  onToggleSave: (job: Job) => void
  onNewSearch: () => void
  onEditProfile: () => void
}) {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('score')
  const [selectedId, setSelectedId] = useState<string | null>(jobs[0]?.id ?? null)
  const [letterFor, setLetterFor] = useState<Job | null>(null)

  const counts = useMemo(() => {
    const c = { all: jobs.length, 'Strong Match': 0, 'Good Match': 0, 'Partial Match': 0 } as Record<Filter, number>
    for (const j of jobs) if (j.match_label && j.match_label in c) c[j.match_label as Filter]++
    return c
  }, [jobs])

  const visible = useMemo(() => {
    const list = filter === 'all' ? jobs : jobs.filter((j) => j.match_label === filter)
    if (sort === 'recent') return [...list].sort((a, b) => (b.posted || '').localeCompare(a.posted || ''))
    return [...list].sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0))
  }, [jobs, filter, sort])

  const selected = jobs.find((j) => j.id === selectedId) ?? visible[0] ?? null
  const strong = counts['Strong Match']

  const openJob = (job: Job) => {
    setSelectedId(job.id)
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
      router.push(`/jobs/${job.id}`)
    }
  }

  return (
    <div className="fade-up">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow text-accent">
            {jobs.length} opportunities · {cacheHit ? 'from recent results' : 'live'}
          </div>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{strong > 0 ? `${strong} strong match${strong > 1 ? 'es' : ''} for you` : 'Your ranked matches'}</h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {keywords.map((k) => (
              <span key={k} className="pill pill-muted">
                {k}
              </span>
            ))}
            {location && <span className="pill pill-muted">{location}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost h-9 text-xs" onClick={onEditProfile} type="button">
            <ArrowLeft size={13} /> Adjust profile
          </button>
          <button className="btn btn-soft h-9 text-xs" onClick={onNewSearch} type="button">
            <RotateCcw size={13} /> New search
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(['all', 'Strong Match', 'Good Match', 'Partial Match'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-full border px-3.5 py-1.5 font-display text-xs font-semibold transition',
              filter === f ? 'border-primary/60 bg-primary-soft text-ink' : 'border-line-soft text-muted hover:border-line hover:text-ink',
            )}
          >
            {f === 'all' ? 'All' : f.replace(' Match', '')} <span className="ml-1 text-dim">{counts[f]}</span>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted">
          <SlidersHorizontal size={13} />
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="rounded-md border border-line-soft bg-transparent px-2 py-1 text-xs text-ink-2 outline-none">
            <option value="score">Best fit first</option>
            <option value="recent">Most recent</option>
          </select>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState title="Nothing in this bucket" body="Try another filter — or adjust your profile and search again." action={{ label: 'Show all', onClick: () => setFilter('all') }} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="space-y-2.5">
            {visible.map((job, i) => (
              <JobCard key={job.id} job={job} index={i} selected={selected?.id === job.id} onSelect={() => openJob(job)} onToggleSave={() => onToggleSave(job)} />
            ))}
          </div>
          <div className="hidden lg:block">
            {selected && <JobDetailPane job={selected} onToggleSave={() => onToggleSave(selected)} onCoverLetter={() => setLetterFor(selected)} />}
          </div>
        </div>
      )}

      {letterFor && <CoverLetterModal job={letterFor} profile={profile} open={!!letterFor} onClose={() => setLetterFor(null)} />}
    </div>
  )
}
