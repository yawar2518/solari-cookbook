'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Bookmark, ExternalLink, FileText, Globe, RefreshCw } from 'lucide-react'
import { CoverLetterModal } from '@/components/cover/CoverLetterModal'
import { MatchAnalysis } from '@/components/search/JobDetailPane'
import { useUser } from '@/components/providers/UserProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { ScoreRing } from '@/components/ui/ScoreRing'
import { ErrorState, Skeleton, Spinner } from '@/components/ui/States'
import { api, ApiError, errorMessage } from '@/lib/api'
import type { Job } from '@/lib/types'
import { cn, labelPill, timeAgo } from '@/lib/utils'
import { CompanyResearchPanel } from './CompanyResearchPanel'

export function JobDetail({ jobId }: { jobId: string }) {
  const { me, refresh } = useUser()
  const toast = useToast()
  const router = useRouter()
  const [job, setJob] = useState<Job | null>(null)
  const [error, setError] = useState<{ message: string; notFound: boolean } | null>(null)
  // undefined = not fetched yet (loading), null = fetched but unavailable
  const [description, setDescription] = useState<string | null | undefined>(undefined)
  const [letter, setLetter] = useState(false)
  const descStartedFor = useRef<string | null>(null)
  const descLoading = description === undefined

  const load = () =>
    api
      .job(jobId)
      .then((res) => {
        setJob(res.job)
        setDescription(res.job.description ?? undefined)
      })
      .catch((err: unknown) => setError({ message: errorMessage(err), notFound: err instanceof ApiError && err.status === 404 }))

  const fetchDescription = () =>
    api
      .jobDescription(jobId)
      .then((res) => {
        setDescription(res.description)
        if (!res.description) toast.info('No description available', 'The listing page did not expose one. Open the original listing instead.')
      })
      .catch((err: unknown) => {
        toast.error('Could not fetch the description', errorMessage(err))
        setDescription(null)
      })

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  useEffect(() => {
    if (job && description === undefined && descStartedFor.current !== jobId) {
      descStartedFor.current = jobId
      void fetchDescription()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job])

  const refetchDescription = () => {
    setDescription(undefined)
    void fetchDescription()
  }

  const retry = () => {
    setError(null)
    void load()
  }

  const toggleSave = async () => {
    if (!job) return
    const next = !job.saved
    setJob({ ...job, saved: next })
    try {
      if (next) await api.saveJob(job)
      else await api.unsaveJob(job.id)
      void refresh()
    } catch (err) {
      setJob({ ...job, saved: !next })
      toast.error('Could not update saved jobs', errorMessage(err))
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorState
          title={error.notFound ? "We couldn't find that job" : 'Could not load this job'}
          body={error.notFound ? 'It may be from an older search that has expired. Run a fresh search to see live listings.' : error.message}
          onRetry={error.notFound ? undefined : retry}
        />
        <div className="mt-4 text-center">
          <Link href="/search" className="btn btn-primary">
            Run a new search
          </Link>
        </div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-8 w-40" />
        <div className="card p-6">
          <div className="flex gap-4">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl">
      <button onClick={() => (history.length > 1 ? router.back() : router.push('/search'))} className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink" type="button">
        <ArrowLeft size={13} /> Back
      </button>

      <div className="card p-5 sm:p-6 fade-up">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <ScoreRing score={job.match_score} size={84} stroke={5} showLabel />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold leading-tight">{job.title}</h1>
            <div className="mt-1.5 text-sm text-muted">
              <span className="font-medium text-ink-2">{job.company}</span>
              {job.location && <span> · {job.location}</span>}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {job.match_label && <span className={labelPill(job.match_label)}>{job.match_label}</span>}
              <span className="pill pill-muted">{job.source}</span>
              {job.posted && <span className="text-[11px] text-dim">posted {timeAgo(job.posted)}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-col">
            <button className="btn btn-primary h-10 text-xs" onClick={() => setLetter(true)} type="button">
              <FileText size={14} /> Cover letter
            </button>
            <button className={cn('btn h-10 text-xs', job.saved ? 'btn-accent' : 'btn-ghost')} onClick={toggleSave} type="button">
              <Bookmark size={14} fill={job.saved ? 'currentColor' : 'none'} /> {job.saved ? 'Saved' : 'Save'}
            </button>
            {job.url && (
              <a href={job.url} target="_blank" rel="noreferrer" className="btn btn-ghost h-10 text-xs">
                <ExternalLink size={14} /> Apply on {job.source}
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="eyebrow">Job description</div>
              {!descLoading && (
                <button onClick={refetchDescription} className="text-xs text-dim hover:text-ink" type="button">
                  <RefreshCw size={12} className="mr-1 inline" /> Refetch
                </button>
              )}
            </div>
            {descLoading ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-accent">
                  <Spinner size={14} /> <span className="font-display">Reading the listing page…</span>
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-11/12" />
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-3 w-full" />
              </div>
            ) : description ? (
              <p className="prose-fyt max-h-[520px] overflow-y-auto pr-2 scroll-thin">{description}</p>
            ) : (
              <div className="text-sm text-muted">
                {job.snippet ? <p className="mb-3 text-ink-2">{job.snippet}</p> : null}
                We couldn&apos;t pull the full description from the listing page.{' '}
                {job.url && (
                  <a href={job.url} target="_blank" rel="noreferrer" className="text-sky hover:underline">
                    Read it on {job.source} <Globe size={11} className="inline" />
                  </a>
                )}
              </div>
            )}
          </div>

          <CompanyResearchPanel jobId={job.id} company={job.company} descriptionReady={!descLoading} />
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <div className="eyebrow mb-3">Match analysis</div>
            <MatchAnalysis job={job} />
          </div>
          {me?.user.plan === 'free' && (
            <div className="card border-accent/25 p-5">
              <div className="eyebrow text-accent">Pro tip</div>
              <p className="mt-1.5 text-sm text-muted">Pro letters are written from this exact description, and fyt tells you which CV bullets to rewrite for it.</p>
              <Link href="/pricing" className="btn btn-accent mt-4 h-9 w-full text-xs">
                See what Pro unlocks
              </Link>
            </div>
          )}
        </div>
      </div>

      {letter && <CoverLetterModal job={job} profile={me?.profile.parsed_profile ?? null} open onClose={() => setLetter(false)} />}
    </div>
  )
}
