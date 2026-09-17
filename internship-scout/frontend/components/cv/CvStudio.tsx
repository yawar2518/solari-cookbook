'use client'

import { useEffect, useState } from 'react'
import { FileUp, PenLine } from 'lucide-react'
import { CardSkeleton, ErrorState } from '@/components/ui/States'
import { api, errorMessage } from '@/lib/api'
import type { CvState } from '@/lib/types'
import { cn } from '@/lib/utils'
import { CvUpload } from './CvUpload'
import { CvWizard } from './CvWizard'

type Tab = 'upload' | 'build'

export function CvStudio() {
  const [tab, setTab] = useState<Tab>('upload')
  const [state, setState] = useState<CvState | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = () =>
    api
      .cv()
      .then((s) => {
        setState(s)
        if (!s.cv_parsed && s.generated_cv) setTab('build')
      })
      .catch((err: unknown) => setError(errorMessage(err)))

  useEffect(() => {
    void load()
  }, [])

  const retry = () => {
    setError(null)
    void load()
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">CV studio</div>
          <h1 className="mt-1 text-3xl font-bold">Your CV, reviewed and rebuilt.</h1>
          <p className="mt-1 max-w-xl text-muted">Upload what you have for an honest review, or build an ATS-safe CV from scratch in six short steps.</p>
        </div>
        <div className="flex rounded-xl border border-line-soft bg-base/50 p-1">
          {(
            [
              ['upload', 'Upload & review', FileUp],
              ['build', 'Build from scratch', PenLine],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn('flex items-center gap-2 rounded-lg px-3.5 py-2 font-display text-xs font-semibold transition', tab === key ? 'bg-primary-soft text-ink' : 'text-muted hover:text-ink')}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <ErrorState body={error} onRetry={retry} />
      ) : !state ? (
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : tab === 'upload' ? (
        <CvUpload state={state} onStateChange={(patch) => setState((s) => (s ? { ...s, ...patch } : s))} />
      ) : (
        <CvWizard existing={state.generated_cv} onGenerated={(cv) => setState((s) => (s ? { ...s, generated_cv: cv } : s))} />
      )}
    </div>
  )
}
