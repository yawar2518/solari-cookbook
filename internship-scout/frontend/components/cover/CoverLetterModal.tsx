'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, Copy, ExternalLink, RefreshCw, Sparkles } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { InlineError, LockedOverlay, Spinner } from '@/components/ui/States'
import { LETTER_MESSAGES, ThinkingLine } from '@/components/ui/Thinking'
import { useUser } from '@/components/providers/UserProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { api, errorMessage } from '@/lib/api'
import type { CvTailoring, Job, ParsedProfile } from '@/lib/types'

export function CoverLetterModal({ job, profile, open, onClose }: { job: Job; profile: ParsedProfile | null; open: boolean; onClose: () => void }) {
  const { me, refresh } = useUser()
  const toast = useToast()
  const [text, setText] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tailored, setTailored] = useState(false)
  const [copied, setCopied] = useState(false)
  const [tailoring, setTailoring] = useState<CvTailoring | null>(null)
  const [tailoringBusy, setTailoringBusy] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const startedRef = useRef(false)
  const isPro = me?.user.plan === 'pro'

  const generate = async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setText('')
    setError(null)
    setStreaming(true)
    setTailoring(null)
    try {
      const result = await api.coverLetter(job, profile, setText, controller.signal)
      setTailored(result.tailored)
      void refresh()
      if (result.tailored) void loadTailoring()
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError(errorMessage(err))
        void refresh()
      }
    } finally {
      setStreaming(false)
    }
  }

  const loadTailoring = async () => {
    setTailoringBusy(true)
    try {
      const res = await api.cvTailoring(job, profile)
      setTailoring(res.suggestions)
    } catch {
      /* non-critical */
    } finally {
      setTailoringBusy(false)
    }
  }

  useEffect(() => {
    if (open && !startedRef.current) {
      startedRef.current = true
      void generate()
    }
    if (!open) {
      startedRef.current = false
      abortRef.current?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={tailored ? 'Cover letter · tailored to this listing' : 'Cover letter'}
      title={`${job.title} at ${job.company}`}
      size="lg"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] text-dim">
            {isPro ? 'Pro: tailored to the full job description.' : 'Free letters use your profile and the role title. Pro reads the full listing.'}
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost h-9 text-xs" onClick={generate} disabled={streaming} type="button">
              <RefreshCw size={13} /> Regenerate
            </button>
            <button className="btn btn-soft h-9 text-xs" onClick={copy} disabled={!text || streaming} type="button">
              {copied ? <Check size={13} /> : <Copy size={13} />} Copy
            </button>
            {job.url && (
              <a href={job.url} target="_blank" rel="noreferrer" className="btn btn-primary h-9 text-xs">
                <ExternalLink size={13} /> Apply
              </a>
            )}
          </div>
        </div>
      }
    >
      {error ? (
        <InlineError message={error} />
      ) : (
        <div className="space-y-5">
          <div className="surface p-5">
            {streaming && !text && <ThinkingLine messages={LETTER_MESSAGES} className="mb-2" />}
            <p className="prose-fyt">
              {text}
              {streaming && <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 bg-accent animate-blink" />}
            </p>
          </div>

          {!streaming && text && (
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-accent">
                <Sparkles size={13} /> CV tailoring for this job
              </div>
              {isPro ? (
                tailoringBusy ? (
                  <div className="surface flex items-center gap-2 p-4 text-sm text-muted">
                    <Spinner size={14} /> Reading the listing against your CV…
                  </div>
                ) : tailoring ? (
                  <TailoringView t={tailoring} />
                ) : (
                  <button className="btn btn-ghost h-9 text-xs" onClick={loadTailoring} type="button">
                    Generate CV suggestions
                  </button>
                )
              ) : (
                <LockedOverlay title="CV tailoring is a Pro feature" body="Pro reads the full listing and tells you exactly which bullets to rewrite and which keywords to add.">
                  <TailoringView t={PLACEHOLDER} />
                </LockedOverlay>
              )}
            </div>
          )}
          {!isPro && !streaming && (
            <div className="text-[11px] text-dim">
              Want it to reference the actual job description?{' '}
              <Link href="/pricing" className="text-accent hover:underline">
                See Pro
              </Link>
              .
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

function TailoringView({ t }: { t: CvTailoring }) {
  return (
    <div className="surface space-y-3 p-4 text-sm">
      {t.headline && <div className="font-medium text-ink">{t.headline}</div>}
      {!!t.keywords_to_add?.length && (
        <div>
          <div className="mb-1 text-[11px] uppercase tracking-wider text-dim">Keywords to add</div>
          <div className="flex flex-wrap gap-1.5">
            {t.keywords_to_add.map((k) => (
              <span key={k} className="pill pill-primary">
                {k}
              </span>
            ))}
          </div>
        </div>
      )}
      {!!t.bullets_to_rewrite?.length && (
        <div>
          <div className="mb-1 text-[11px] uppercase tracking-wider text-dim">Bullets to rewrite</div>
          <ul className="space-y-2">
            {t.bullets_to_rewrite.map((b, i) => (
              <li key={i} className="rounded-lg border border-line-soft p-3">
                <div className="text-xs text-dim line-through">{b.current}</div>
                <div className="mt-1 text-ink-2">{b.suggested}</div>
                <div className="mt-1 text-xs text-muted">{b.why}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {t.sections_to_reorder && <div className="text-xs text-muted">{t.sections_to_reorder}</div>}
      {!!t.remove?.length && (
        <div className="text-xs text-muted">
          <span className="text-dim">Consider cutting:</span> {t.remove.join(' · ')}
        </div>
      )}
    </div>
  )
}

const PLACEHOLDER: CvTailoring = {
  headline: 'Lead with your automation work and the Claude API project.',
  keywords_to_add: ['LLM pipelines', 'workflow automation', 'REST APIs', 'prompt engineering'],
  bullets_to_rewrite: [
    { current: 'Built automations with n8n', suggested: 'Automated 4 client workflows with n8n and the Claude API, cutting manual reporting time by ~6 hours/week', why: 'Mirrors the listing’s emphasis on measurable automation impact.' },
  ],
  sections_to_reorder: 'Move Projects above Education for this application.',
  remove: [],
}
