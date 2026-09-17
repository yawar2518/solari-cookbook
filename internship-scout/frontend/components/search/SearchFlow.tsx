'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useUser } from '@/components/providers/UserProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { ErrorState, InlineError } from '@/components/ui/States'
import { api, ApiError, errorMessage } from '@/lib/api'
import type { Job, ParsedProfile, SearchRun } from '@/lib/types'
import { ContextEditor } from './ContextEditor'
import { ProfilePreview } from './ProfilePreview'
import { ResultsWorkspace } from './ResultsWorkspace'
import { SearchProgress } from './SearchProgress'

type Phase = 'input' | 'parsing' | 'profile' | 'searching' | 'results'

const POLL_MS = 2500

export function SearchFlow() {
  const { me, refresh } = useUser()
  const toast = useToast()
  const router = useRouter()
  const params = useSearchParams()
  const resumeRunId = params.get('run')

  // A ?run= in the URL means we are resuming a background search.
  const [phase, setPhase] = useState<Phase>(resumeRunId ? 'searching' : 'input')
  const [contextText, setContextText] = useState(me?.profile.raw_context || '')
  const [profile, setProfile] = useState<ParsedProfile | null>(me?.profile.parsed_profile || null)
  const [profileCached, setProfileCached] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [run, setRun] = useState<SearchRun | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [keywords, setKeywords] = useState<string[]>([])
  const [location, setLocation] = useState('')
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirtyProfile = useRef(false)

  // When the account loads after first render, seed the editor/profile once.
  const [seenMe, setSeenMe] = useState(me)
  if (me !== seenMe) {
    setSeenMe(me)
    if (me?.profile.raw_context && !contextText) setContextText(me.profile.raw_context)
    if (me?.profile.parsed_profile && !profile) setProfile(me.profile.parsed_profile)
  }

  const hasExistingProfile = !!me?.profile.parsed_profile

  function stopPolling() {
    if (pollTimer.current) clearTimeout(pollTimer.current)
    pollTimer.current = null
  }

  function schedule(runId: string, delay: number) {
    stopPolling()
    pollTimer.current = setTimeout(() => void poll(runId), delay)
  }

  async function poll(runId: string) {
    try {
      const status = await api.searchStatus(runId)
      setRun(status)
      setKeywords(status.keywords || [])
      setLocation(status.location || '')
      if (status.status === 'done') {
        setJobs(status.jobs || [])
        setPhase('results')
        void refresh()
        if (!status.jobs?.length) toast.info('No listings found', 'Your credit was refunded. Try broader keywords or a different location.')
        return
      }
      if (status.status === 'error') {
        setError(status.error || 'The search failed.')
        setPhase('profile')
        void refresh()
        return
      }
      schedule(runId, POLL_MS)
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError('That search no longer exists. Start a new one.')
        setPhase(profile ? 'profile' : 'input')
        return
      }
      // Transient network error: keep polling, a little slower.
      schedule(runId, POLL_MS * 2)
    }
  }

  useEffect(() => {
    if (resumeRunId) schedule(resumeRunId, 0)
    return stopPolling
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeRunId])

  const handleContext = async (text: string) => {
    setError(null)
    setPhase('parsing')
    setContextText(text)
    try {
      const res = await api.parseContext(text, dirtyProfile.current)
      setProfile(res.profile)
      setProfileCached(res.cached)
      dirtyProfile.current = false
      setPhase('profile')
      void refresh()
    } catch (err) {
      setError(errorMessage(err))
      setPhase('input')
    }
  }

  const useExisting = () => {
    if (!me?.profile.parsed_profile) return
    setProfile(me.profile.parsed_profile)
    setProfileCached(true)
    setError(null)
    setPhase('profile')
  }

  const handleProfileChange = (next: ParsedProfile) => {
    dirtyProfile.current = true
    setProfile(next)
  }

  const startSearch = async (locationOverride: string) => {
    if (!profile) return
    setError(null)
    setStarting(true)
    try {
      if (dirtyProfile.current) {
        await api.updateProfile(profile)
        dirtyProfile.current = false
      }
      const res = await api.startSearch(profile, locationOverride)
      setKeywords(res.keywords)
      setLocation(res.location)
      setRun(null)
      setPhase('searching')
      void refresh()
      // Putting the id in the URL makes the run resumable after a reload or
      // from the dashboard, and triggers the polling effect above.
      router.replace(`/search?run=${res.run_id}`)
      schedule(res.run_id, 0)
    } catch (err) {
      const msg = errorMessage(err)
      setError(msg)
      if (err instanceof ApiError && (err.isPaywall || err.isRateLimit)) toast.error('Search limit reached', msg)
    } finally {
      setStarting(false)
    }
  }

  const toggleSave = async (job: Job) => {
    const next = !job.saved
    setJobs((list) => list.map((j) => (j.id === job.id ? { ...j, saved: next } : j)))
    try {
      if (next) await api.saveJob(job)
      else await api.unsaveJob(job.id)
      toast.success(next ? 'Saved' : 'Removed from saved', next ? `${job.title} is on your dashboard.` : undefined)
      void refresh()
    } catch (err) {
      setJobs((list) => list.map((j) => (j.id === job.id ? { ...j, saved: !next } : j)))
      toast.error('Could not update saved jobs', errorMessage(err))
    }
  }

  const newSearch = () => {
    stopPolling()
    router.replace('/search')
    setRun(null)
    setJobs([])
    setError(null)
    setPhase(profile ? 'profile' : 'input')
  }

  const searchesLeft = me?.usage.plan === 'pro' ? null : Math.min(me?.usage.searches.remaining_today ?? 0, me?.usage.searches.balance ?? 0)

  return (
    <div className="mx-auto max-w-6xl">
      {error && phase !== 'searching' && <InlineError message={error} className="mb-5" />}

      {(phase === 'input' || phase === 'parsing') && (
        <ContextEditor initialText={contextText} isParsing={phase === 'parsing'} onSubmit={handleContext} hasExistingProfile={hasExistingProfile} onUseExisting={useExisting} />
      )}

      {phase === 'profile' && profile && (
        <ProfilePreview
          profile={profile}
          onChange={handleProfileChange}
          onConfirm={startSearch}
          onBack={() => setPhase('input')}
          isStarting={starting}
          cached={profileCached}
          searchesLeft={searchesLeft}
        />
      )}

      {phase === 'searching' &&
        (run?.status === 'error' ? <ErrorState title="Search failed" body={run.error || undefined} onRetry={newSearch} /> : <SearchProgress run={run} keywords={keywords} location={location} />)}

      {phase === 'results' && (
        <ResultsWorkspace
          jobs={jobs}
          profile={profile}
          keywords={keywords}
          location={location}
          cacheHit={run?.cache_hit ?? null}
          onToggleSave={toggleSave}
          onNewSearch={newSearch}
          onEditProfile={() => {
            stopPolling()
            setPhase(profile ? 'profile' : 'input')
          }}
        />
      )}
    </div>
  )
}
