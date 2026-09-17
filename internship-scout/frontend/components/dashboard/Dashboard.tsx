'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, Bookmark, FileText, History, Radar, Sparkles } from 'lucide-react'
import { useUser } from '@/components/providers/UserProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { JobCard } from '@/components/search/JobCard'
import { CardSkeleton, EmptyState, ProgressBar, Skeleton } from '@/components/ui/States'
import { api, errorMessage } from '@/lib/api'
import type { Job, SearchRunSummary } from '@/lib/types'
import { cn, formatDateTime, initials, timeAgo } from '@/lib/utils'

export function Dashboard() {
  const { me, loading, refresh } = useUser()
  const toast = useToast()
  const [matches, setMatches] = useState<{ jobs: Job[]; searched_at: string | null; run_id: string | null } | null>(null)
  const [saved, setSaved] = useState<Job[] | null>(null)
  const [runs, setRuns] = useState<SearchRunSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [m, s, r] = await Promise.all([api.recentMatches(6), api.savedJobs(), api.recentSearches()])
        if (cancelled) return
        setMatches(m)
        setSaved(s.jobs)
        setRuns(r.runs)
      } catch (err) {
        if (!cancelled) setError(errorMessage(err))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const toggleSave = async (job: Job, fromSaved = false) => {
    const next = !job.saved
    setMatches((m) => (m ? { ...m, jobs: m.jobs.map((j) => (j.id === job.id ? { ...j, saved: next } : j)) } : m))
    setSaved((s) => (s ? (next ? [{ ...job, saved: true }, ...s.filter((j) => j.id !== job.id)] : s.filter((j) => j.id !== job.id)) : s))
    try {
      if (next) await api.saveJob(job)
      else await api.unsaveJob(job.id)
      void refresh()
    } catch (err) {
      toast.error('Could not update saved jobs', errorMessage(err))
      if (fromSaved) setSaved((s) => (s ? [job, ...s] : s))
    }
  }

  const user = me?.user
  const usage = me?.usage
  const completeness = me?.completeness
  const activeRun = runs?.find((r) => r.status !== 'done' && r.status !== 'error')

  return (
    <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)_280px]">
      {/* Left rail */}
      <aside className="space-y-4">
        <div className="card overflow-hidden">
          <div className="h-16 bg-gradient-to-r from-primary/40 via-primary/20 to-accent/20" />
          <div className="-mt-7 px-5 pb-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-surface bg-surface-3 font-display text-lg font-semibold text-ink">
              {loading && !user ? '' : initials(user?.full_name, user?.email)}
            </div>
            {loading && !user ? (
              <div className="mt-3 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ) : (
              <>
                <div className="mt-3 truncate font-display text-base font-semibold text-ink">{user?.full_name || user?.email.split('@')[0]}</div>
                <div className="truncate text-xs text-muted">{user?.email}</div>
                <div className="mt-3 flex items-center gap-2">
                  <span className={cn('pill', user?.plan === 'pro' ? 'pill-accent' : 'pill-muted')}>{user?.plan === 'pro' ? 'PRO' : 'FREE'}</span>
                  {user?.plan === 'free' && (
                    <Link href="/pricing" className="text-xs text-accent hover:underline">
                      Upgrade
                    </Link>
                  )}
                </div>
                {me?.profile.parsed_profile?.summary && <p className="mt-4 line-clamp-4 text-xs leading-relaxed text-muted">{me.profile.parsed_profile.summary}</p>}
              </>
            )}
          </div>
        </div>

        <div className="card p-5">
          <div className="eyebrow mb-3">Credits</div>
          {usage?.plan === 'pro' ? (
            <div className="text-sm text-accent">Unlimited searches and cover letters.</div>
          ) : usage ? (
            <div className="space-y-4">
              <Meter label="Searches today" used={usage.searches.used_today ?? 0} limit={usage.searches.limit_today ?? 3} balance={usage.searches.balance ?? 0} />
              <Meter label="Cover letters today" used={usage.cover_letters.used_today ?? 0} limit={usage.cover_letters.limit_today ?? 3} balance={usage.cover_letters.balance ?? 0} tone="accent" />
            </div>
          ) : (
            <Skeleton className="h-16 w-full" />
          )}
        </div>

        <div className="card p-5">
          <div className="eyebrow mb-3">Quick stats</div>
          <dl className="grid grid-cols-3 gap-2 text-center">
            {[
              ['Searches', me?.stats.searches],
              ['Saved', me?.stats.saved_jobs],
              ['Letters', me?.stats.cover_letters],
            ].map(([label, value]) => (
              <div key={label as string} className="surface py-2">
                <dd className="font-display text-lg font-bold text-ink">{value ?? '–'}</dd>
                <dt className="text-[10px] uppercase tracking-wider text-dim">{label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </aside>

      {/* Main */}
      <section className="min-w-0 space-y-5">
        {activeRun && (
          <Link href={`/search?run=${activeRun.id}`} className="card flex items-center gap-3 border-primary/50 p-4 shadow-glow">
            <span className="inline-flex items-center gap-1">
              <span className="pulse-dot" />
              <span className="pulse-dot" />
              <span className="pulse-dot" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-ink">A search is still running</div>
              <div className="truncate text-xs text-muted">
                {activeRun.stage || activeRun.status} · {activeRun.keywords.join(', ')}
              </div>
            </div>
            <ArrowRight size={16} className="text-sky" />
          </Link>
        )}

        {!me?.profile.parsed_profile && !loading && (
          <div className="card relative overflow-hidden p-6 shadow-glow">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/10 blur-3xl" />
            <div className="eyebrow text-accent">Start here</div>
            <h2 className="mt-1 text-xl font-bold">Tell fyt who you are.</h2>
            <p className="mt-2 max-w-md text-sm text-muted">One paragraph in plain English. fyt infers your level, your hidden skills and the roles that fit — then finds live listings.</p>
            <Link href="/search" className="btn btn-primary mt-5">
              <Sparkles size={15} /> Describe yourself
            </Link>
          </div>
        )}

        <div>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="text-lg font-semibold">Your latest matches</h2>
              {matches?.searched_at && <div className="text-xs text-dim">Searched {timeAgo(matches.searched_at)}</div>}
            </div>
            <Link href="/search" className="btn btn-soft h-8 text-xs">
              <Radar size={13} /> New search
            </Link>
          </div>
          {error ? (
            <EmptyState title="Could not load matches" body={error} action={{ label: 'Reload', onClick: () => window.location.reload() }} />
          ) : matches === null ? (
            <div className="space-y-2.5">
              <CardSkeleton lines={1} />
              <CardSkeleton lines={1} />
            </div>
          ) : matches.jobs.length === 0 ? (
            <EmptyState
              icon={<Radar size={22} />}
              title="No matches yet"
              body="Run your first search and your top-ranked opportunities will show up here."
              action={{ label: 'Find matches', href: '/search' }}
            />
          ) : (
            <div className="space-y-2.5">
              {matches.jobs.map((job, i) => (
                <Link key={job.id} href={`/jobs/${job.id}`} className="block">
                  <JobCard job={job} index={i} onToggleSave={() => toggleSave(job)} />
                </Link>
              ))}
              {matches.run_id && (
                <Link href={`/search?run=${matches.run_id}`} className="btn btn-ghost h-9 w-full text-xs">
                  See all {matches.jobs.length < 6 ? '' : 'ranked '}results <ArrowRight size={13} />
                </Link>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-lg font-semibold">Saved jobs</h2>
            <Link href="/saved" className="text-xs text-sky hover:underline">
              View all
            </Link>
          </div>
          {saved === null ? (
            <CardSkeleton lines={1} />
          ) : saved.length === 0 ? (
            <EmptyState icon={<Bookmark size={20} />} title="Nothing saved" body="Tap the bookmark on any match to keep it here." className="py-8" />
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {saved.slice(0, 4).map((job, i) => (
                <Link key={job.id} href={`/jobs/${job.id}`} className="block">
                  <JobCard job={job} index={i} compact onToggleSave={() => toggleSave(job, true)} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Right rail */}
      <aside className="space-y-4">
        <div className="card p-5">
          <div className="eyebrow mb-3">Profile strength</div>
          {completeness ? (
            <>
              <div className="flex items-center gap-4">
                <CompletenessRing value={completeness.score} />
                <div>
                  <div className="font-display text-2xl font-bold text-ink">{completeness.score}%</div>
                  <div className="text-xs text-muted">{completeness.score >= 80 ? 'Strong — matches will be precise.' : completeness.score >= 50 ? 'Good start. A few more details help.' : 'Thin profile. Add detail for better matches.'}</div>
                </div>
              </div>
              {completeness.suggestions.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {completeness.suggestions.map((s) => (
                    <li key={s.key}>
                      <Link href={s.href} className="surface flex items-center justify-between gap-2 px-3 py-2 text-xs text-ink-2 transition hover:border-primary/50">
                        <span>{s.label}</span>
                        <span className="shrink-0 text-accent">+{s.weight}%</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <Skeleton className="h-20 w-full" />
          )}
        </div>

        <div className="card p-5">
          <div className="eyebrow mb-3">Recent searches</div>
          {runs === null ? (
            <Skeleton className="h-16 w-full" />
          ) : runs.length === 0 ? (
            <div className="text-xs text-dim">No searches yet.</div>
          ) : (
            <ul className="space-y-2">
              {runs.slice(0, 5).map((r) => (
                <li key={r.id}>
                  <Link href={`/search?run=${r.id}`} className="surface block px-3 py-2 transition hover:border-primary/50">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium text-ink">{r.keywords[0] || 'Search'}</span>
                      <span className={cn('shrink-0 text-[10px] uppercase tracking-wider', r.status === 'done' ? 'text-accent' : r.status === 'error' ? 'text-warning' : 'text-sky')}>
                        {r.status === 'done' ? `${r.total} found` : r.status}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-dim">
                      <History size={10} /> {formatDateTime(r.created_at)}
                      {r.cache_hit && <span className="ml-1 text-dim">· cached</span>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <div className="eyebrow mb-3">Shortcuts</div>
          <div className="space-y-1.5">
            <Link href="/cv" className="surface flex items-center gap-2 px-3 py-2 text-xs text-ink-2 transition hover:border-primary/50">
              <FileText size={13} className="text-sky" /> {me?.profile.has_cv || me?.profile.has_generated_cv ? 'Open CV studio' : 'Upload or build your CV'}
            </Link>
            <Link href="/pricing" className="surface flex items-center gap-2 px-3 py-2 text-xs text-ink-2 transition hover:border-primary/50">
              <Sparkles size={13} className="text-accent" /> What Pro unlocks
            </Link>
          </div>
        </div>
      </aside>
    </div>
  )
}

function Meter({ label, used, limit, balance, tone = 'primary' }: { label: string; used: number; limit: number; balance: number; tone?: 'primary' | 'accent' }) {
  const left = Math.max(0, limit - used)
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className={cn('font-medium', left === 0 ? 'text-warning' : 'text-ink')}>
          {left}/{limit} left
        </span>
      </div>
      <ProgressBar value={(left / limit) * 100} tone={left === 0 ? 'warning' : tone} />
      <div className="mt-1 text-[11px] text-dim">{balance} credit{balance === 1 ? '' : 's'} remaining in total</div>
    </div>
  )
}

function CompletenessRing({ value }: { value: number }) {
  const size = 64
  const r = 27
  const c = 2 * Math.PI * r
  const color = value >= 80 ? '#64FFDA' : value >= 50 ? '#7EB8FF' : '#FFC857'
  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0" aria-hidden="true">
      <circle cx={32} cy={32} r={r} stroke="rgba(26,58,107,0.6)" strokeWidth="5" fill="none" />
      <circle cx={32} cy={32} r={r} stroke={color} strokeWidth="5" fill="none" strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`} style={{ transition: 'stroke-dasharray 0.8s ease' }} />
    </svg>
  )
}
