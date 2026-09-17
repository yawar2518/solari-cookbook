'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Bookmark, FileText, Trash2 } from 'lucide-react'
import { CoverLetterModal } from '@/components/cover/CoverLetterModal'
import { useUser } from '@/components/providers/UserProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { JobCard } from '@/components/search/JobCard'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States'
import { api, errorMessage } from '@/lib/api'
import type { Job } from '@/lib/types'
import { formatDateTime } from '@/lib/utils'

export function SavedJobs() {
  const { me, refresh } = useUser()
  const toast = useToast()
  const [jobs, setJobs] = useState<Job[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [letterFor, setLetterFor] = useState<Job | null>(null)
  const [notesFor, setNotesFor] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState('')

  const load = () =>
    api
      .savedJobs()
      .then((res) => setJobs(res.jobs))
      .catch((err: unknown) => setError(errorMessage(err)))

  useEffect(() => {
    void load()
  }, [])

  const retry = () => {
    setError(null)
    void load()
  }

  const remove = async (job: Job) => {
    setJobs((list) => list?.filter((j) => j.id !== job.id) ?? null)
    try {
      await api.unsaveJob(job.id)
      void refresh()
    } catch (err) {
      toast.error('Could not remove', errorMessage(err))
      void load()
    }
  }

  const saveNotes = async (job: Job) => {
    try {
      await api.updateNotes(job.id, notesDraft)
      setJobs((list) => list?.map((j) => (j.id === job.id ? { ...j, notes: notesDraft } : j)) ?? null)
      setNotesFor(null)
      toast.success('Notes saved')
    } catch (err) {
      toast.error('Could not save notes', errorMessage(err))
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <div className="eyebrow">Saved</div>
        <h1 className="mt-1 text-3xl font-bold">Your shortlist</h1>
        <p className="mt-1 text-muted">Jobs you bookmarked. Add notes, write a letter, or open the listing.</p>
      </div>

      {error ? (
        <ErrorState body={error} onRetry={retry} />
      ) : jobs === null ? (
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : jobs.length === 0 ? (
        <EmptyState icon={<Bookmark size={22} />} title="Nothing saved yet" body="Bookmark matches from a search and they'll live here." action={{ label: 'Find matches', href: '/search' }} />
      ) : (
        <div className="space-y-3">
          {jobs.map((job, i) => (
            <div key={job.id} className="space-y-2">
              <Link href={`/jobs/${job.id}`} className="block">
                <JobCard job={job} index={i} />
              </Link>
              <div className="flex flex-wrap items-center gap-2 px-1">
                <span className="text-[11px] text-dim">Saved {formatDateTime(job.saved_at)}</span>
                <div className="ml-auto flex gap-1.5">
                  <button
                    type="button"
                    className="btn btn-ghost h-8 text-xs"
                    onClick={() => {
                      setNotesFor(notesFor === job.id ? null : job.id)
                      setNotesDraft(job.notes || '')
                    }}
                  >
                    {job.notes ? 'Edit notes' : 'Add notes'}
                  </button>
                  <button type="button" className="btn btn-soft h-8 text-xs" onClick={() => setLetterFor(job)}>
                    <FileText size={13} /> Cover letter
                  </button>
                  <button type="button" className="btn btn-danger h-8 text-xs" onClick={() => remove(job)} aria-label="Remove from saved">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              {notesFor === job.id ? (
                <div className="surface p-3">
                  <textarea className="input-base min-h-[80px] text-sm" value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} placeholder="Application deadline, who to contact, what to prepare…" />
                  <div className="mt-2 flex justify-end gap-2">
                    <button type="button" className="btn btn-ghost h-8 text-xs" onClick={() => setNotesFor(null)}>
                      Cancel
                    </button>
                    <button type="button" className="btn btn-primary h-8 text-xs" onClick={() => saveNotes(job)}>
                      Save notes
                    </button>
                  </div>
                </div>
              ) : (
                job.notes && <div className="surface px-3 py-2 text-xs leading-relaxed text-ink-2 whitespace-pre-wrap">{job.notes}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {letterFor && <CoverLetterModal job={letterFor} profile={me?.profile.parsed_profile ?? null} open onClose={() => setLetterFor(null)} />}
    </div>
  )
}
