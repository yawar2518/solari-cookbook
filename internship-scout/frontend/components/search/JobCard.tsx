'use client'

import { Bookmark, MapPin } from 'lucide-react'
import { ScoreRing } from '@/components/ui/ScoreRing'
import type { Job } from '@/lib/types'
import { cn, labelPill, timeAgo } from '@/lib/utils'

export function JobCard({
  job,
  selected,
  onSelect,
  onToggleSave,
  index = 0,
  compact = false,
}: {
  job: Job
  selected?: boolean
  onSelect?: () => void
  onToggleSave?: () => void
  index?: number
  compact?: boolean
}) {
  return (
    <div
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (onSelect && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        'card card-hover fade-up relative cursor-pointer p-4',
        selected && 'border-primary/70 shadow-glow',
        compact && 'p-3',
      )}
      style={{ animationDelay: `${Math.min(index, 12) * 0.04}s` }}
    >
      <div className="flex items-start gap-3.5">
        <ScoreRing score={job.match_score} size={compact ? 44 : 52} stroke={compact ? 2.5 : 3} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className={cn('truncate font-display font-semibold leading-snug text-ink', compact ? 'text-[13px]' : 'text-[15px]')}>{job.title}</h3>
              <div className="mt-0.5 truncate text-xs text-muted">
                {job.company}
                {job.location && (
                  <>
                    <span className="mx-1.5 text-dim">·</span>
                    <MapPin size={11} className="mr-0.5 inline -translate-y-px" />
                    {job.location}
                  </>
                )}
              </div>
            </div>
            {onToggleSave && (
              <button
                type="button"
                onClick={(e) => {
                  // The card may be wrapped in a <Link>; don't navigate on save.
                  e.preventDefault()
                  e.stopPropagation()
                  onToggleSave()
                }}
                className={cn('shrink-0 rounded-md p-1 transition', job.saved ? 'text-accent' : 'text-dim hover:text-ink')}
                aria-label={job.saved ? 'Unsave job' : 'Save job'}
                title={job.saved ? 'Saved' : 'Save'}
              >
                <Bookmark size={16} fill={job.saved ? 'currentColor' : 'none'} />
              </button>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {job.match_label && <span className={labelPill(job.match_label)}>{job.match_label}</span>}
            <span className="pill pill-muted">{job.source}</span>
            {job.posted && <span className="text-[11px] text-dim">{timeAgo(job.posted)}</span>}
          </div>
          {!compact && job.why_it_fits && <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-2/85">{job.why_it_fits}</p>}
        </div>
      </div>
    </div>
  )
}
