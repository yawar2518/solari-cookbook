'use client'

import Link from 'next/link'
import { AlertCircle, ArrowUpRight, Bookmark, ExternalLink, FileText, GraduationCap, Sparkles } from 'lucide-react'
import { ScoreRing } from '@/components/ui/ScoreRing'
import type { Job } from '@/lib/types'
import { cn, labelPill, timeAgo } from '@/lib/utils'

export function MatchAnalysis({ job, className }: { job: Job; className?: string }) {
  return (
    <div className={cn('space-y-4', className)}>
      {job.why_it_fits && (
        <div className="surface p-4">
          <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-accent">
            <Sparkles size={13} /> Why it fits
          </div>
          <p className="text-sm leading-relaxed text-ink-2">{job.why_it_fits}</p>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="surface p-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-dim">You bring</div>
          <div className="flex flex-wrap gap-1.5">
            {(job.matching_skills || []).map((s) => (
              <span key={s} className="pill pill-accent">
                {s}
              </span>
            ))}
            {!job.matching_skills?.length && <span className="text-xs text-dim">Nothing specific matched</span>}
          </div>
        </div>
        <div className="surface p-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-dim">You&apos;d need</div>
          <div className="flex flex-wrap gap-1.5">
            {(job.missing_skills || []).map((s) => (
              <span key={s} className="pill pill-warning">
                {s}
              </span>
            ))}
            {!job.missing_skills?.length && <span className="pill pill-accent">No major gaps</span>}
          </div>
        </div>
      </div>
      {job.what_you_learn && (
        <div className="surface p-4">
          <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-sky">
            <GraduationCap size={13} /> What you&apos;d learn
          </div>
          <p className="text-sm leading-relaxed text-ink-2">{job.what_you_learn}</p>
        </div>
      )}
      {job.concern && (
        <div className="surface border-warning/25 p-4">
          <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-warning">
            <AlertCircle size={13} /> Honest concern
          </div>
          <p className="text-sm leading-relaxed text-ink-2">{job.concern}</p>
        </div>
      )}
    </div>
  )
}

export function JobDetailPane({ job, onToggleSave, onCoverLetter }: { job: Job; onToggleSave: () => void; onCoverLetter: () => void }) {
  return (
    <div className="card sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto p-5 scroll-thin fade-up" key={job.id}>
      <div className="flex items-start gap-4">
        <ScoreRing score={job.match_score} size={72} stroke={4} showLabel />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold leading-snug text-ink">{job.title}</h2>
          <div className="mt-1 text-sm text-muted">
            {job.company}
            {job.location && <span> · {job.location}</span>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {job.match_label && <span className={labelPill(job.match_label)}>{job.match_label}</span>}
            <span className="pill pill-muted">{job.source}</span>
            {job.posted && <span className="text-[11px] text-dim">posted {timeAgo(job.posted)}</span>}
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <button className="btn btn-primary h-10 text-xs" onClick={onCoverLetter} type="button">
          <FileText size={14} /> Cover letter
        </button>
        <button className={cn('btn h-10 text-xs', job.saved ? 'btn-accent' : 'btn-ghost')} onClick={onToggleSave} type="button">
          <Bookmark size={14} fill={job.saved ? 'currentColor' : 'none'} /> {job.saved ? 'Saved' : 'Save'}
        </button>
        <Link href={`/jobs/${job.id}`} className="btn btn-soft h-10 text-xs">
          <ArrowUpRight size={14} /> Full details
        </Link>
        {job.url ? (
          <a href={job.url} target="_blank" rel="noreferrer" className="btn btn-ghost h-10 text-xs">
            <ExternalLink size={14} /> Open listing
          </a>
        ) : (
          <span className="btn btn-ghost h-10 cursor-not-allowed text-xs opacity-50">No link</span>
        )}
      </div>

      {job.snippet && <p className="mt-4 text-xs leading-relaxed text-muted">{job.snippet}</p>}

      <MatchAnalysis job={job} className="mt-5" />

      <div className="mt-5 text-[11px] leading-relaxed text-dim">
        Company research, the full description and a tailored letter live on the <Link href={`/jobs/${job.id}`} className="text-sky hover:underline">full details</Link> page.
      </div>
    </div>
  )
}
