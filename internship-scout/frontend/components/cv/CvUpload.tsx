'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { CheckCircle2, FileUp, Sparkles, UploadCloud, Wand2 } from 'lucide-react'
import { useUser } from '@/components/providers/UserProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { InlineError, LockedOverlay, Spinner } from '@/components/ui/States'
import { ThinkingLine } from '@/components/ui/Thinking'
import { api, errorMessage } from '@/lib/api'
import type { CvDocument, CvReview, CvState } from '@/lib/types'
import { cn } from '@/lib/utils'
import { CvPreview } from './CvPreview'

const UPLOAD_MESSAGES = ['Reading your CV...', 'Structuring sections...', 'Scoring for ATS...', 'Writing improvement notes...']

export function CvUpload({ state, onStateChange }: { state: CvState; onStateChange: (next: Partial<CvState>) => void }) {
  const { me, refresh } = useUser()
  const toast = useToast()
  const isPro = me?.user.plan === 'pro'
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rewriting, setRewriting] = useState(false)
  const [targetRole, setTargetRole] = useState('')
  const [view, setView] = useState<'review' | 'original' | 'rewrite'>('review')

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    const ok = /\.(pdf|docx)$/i.test(file.name)
    if (!ok) {
      setError('Please upload a PDF or DOCX.')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('That file is over 8 MB.')
      return
    }
    setError(null)
    setUploading(true)
    try {
      const res = await api.uploadCv(file)
      onStateChange({ cv_parsed: res.cv, cv_suggestions: res.review, cv_filename: file.name })
      setView('review')
      toast.success('CV reviewed', res.profile_populated ? 'We also built your search profile from it.' : undefined)
      void refresh()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  const rewrite = async () => {
    setRewriting(true)
    setError(null)
    try {
      const res = await api.atsRewrite(state.cv_parsed, targetRole.trim() || undefined)
      onStateChange({ generated_cv: res.cv })
      setView('rewrite')
      toast.success('ATS rewrite ready')
      void refresh()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setRewriting(false)
    }
  }

  const review = state.cv_suggestions
  const cv = state.cv_parsed

  return (
    <div className="space-y-5">
      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          void handleFile(e.dataTransfer.files?.[0])
        }}
        className={cn('card relative flex flex-col items-center justify-center px-6 py-10 text-center transition', dragging && 'border-accent/60 shadow-glow', uploading && 'py-12')}
      >
        <input ref={inputRef} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={(e) => void handleFile(e.target.files?.[0])} />
        {uploading ? (
          <>
            <div className="relative mb-4 h-14 w-14">
              <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
              <div className="absolute inset-0 animate-spin-slow rounded-full border-2 border-transparent border-t-accent" />
              <FileUp size={20} className="absolute inset-0 m-auto text-accent" />
            </div>
            <ThinkingLine messages={UPLOAD_MESSAGES} />
            <div className="mt-2 text-xs text-dim">Usually 15–30 seconds</div>
          </>
        ) : (
          <>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-sky">
              <UploadCloud size={22} />
            </div>
            <div className="text-sm font-semibold text-ink">{state.cv_filename ? 'Upload a newer version' : 'Drop your CV here'}</div>
            <div className="mt-1 text-xs text-muted">PDF or DOCX, up to 8 MB. Claude extracts it, scores it, and tells you what to fix.</div>
            <button className="btn btn-primary mt-4 h-9 text-xs" onClick={() => inputRef.current?.click()} type="button">
              Choose file
            </button>
            {state.cv_filename && (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-accent">
                <CheckCircle2 size={13} /> {state.cv_filename}
                {state.cv_download_url && (
                  <a href={state.cv_download_url} target="_blank" rel="noreferrer" className="ml-1 text-sky hover:underline">
                    download original
                  </a>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {error && <InlineError message={error} />}

      {cv && review && (
        <>
          <div className="flex flex-wrap gap-2">
            {(['review', 'original', 'rewrite'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn('rounded-full border px-3.5 py-1.5 font-display text-xs font-semibold transition', view === v ? 'border-primary/60 bg-primary-soft text-ink' : 'border-line-soft text-muted hover:text-ink')}
              >
                {v === 'review' ? 'Review' : v === 'original' ? 'Structured CV' : 'ATS rewrite'}
                {v === 'rewrite' && !isPro && <span className="ml-1.5 pill pill-accent py-0 text-[9px]">PRO</span>}
              </button>
            ))}
          </div>

          {view === 'review' && <ReviewView review={review} />}
          {view === 'original' && <CvPreview cv={cv} title="Structured from your upload" />}
          {view === 'rewrite' && (
            <div className="space-y-4">
              <div className="card p-5">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[220px] flex-1">
                    <label className="mb-1 block text-[11px] uppercase tracking-wider text-dim" htmlFor="target-role">
                      Target role (optional)
                    </label>
                    <input id="target-role" className="input-base h-9 text-sm" placeholder="e.g. Backend Developer Intern" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} disabled={!isPro} />
                  </div>
                  {isPro ? (
                    <button className="btn btn-accent h-9 text-xs" onClick={rewrite} disabled={rewriting} type="button">
                      {rewriting ? <Spinner size={13} /> : <Wand2 size={13} />} {state.generated_cv ? 'Rewrite again' : 'Rewrite for ATS'}
                    </button>
                  ) : (
                    <Link href="/pricing" className="btn btn-accent h-9 text-xs">
                      <Sparkles size={13} /> Unlock with Pro
                    </Link>
                  )}
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted">
                  Single page, action-verb bullets, quantified where your facts allow, sections ordered for applicant tracking systems. No tables, columns or graphics.
                </p>
              </div>
              {isPro ? (
                state.generated_cv ? (
                  <CvPreview cv={state.generated_cv} title="ATS-optimised rewrite" saved />
                ) : (
                  <div className="card p-8 text-center text-sm text-muted">Hit “Rewrite for ATS” to generate your improved CV.</div>
                )
              ) : (
                <LockedOverlay title="ATS rewrite is a Pro feature" body="Pro rewrites your CV into a clean single-page format that passes applicant tracking systems, tuned to a target role.">
                  <CvPreview cv={sampleFrom(cv)} title="ATS-optimised rewrite" />
                </LockedOverlay>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ReviewView({ review }: { review: CvReview }) {
  const overall = review.overall_score ?? 0
  const ats = review.ats_score ?? 0
  const order = { high: 0, medium: 1, low: 2 } as Record<string, number>
  const improvements = [...(review.improvements || [])].sort((a, b) => (order[a.priority] ?? 3) - (order[b.priority] ?? 3))
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      <div className="space-y-4">
        <div className="card p-5">
          <div className="eyebrow mb-4">Scores</div>
          <div className="grid grid-cols-2 gap-3">
            <Gauge label="Overall" value={overall} />
            <Gauge label="ATS readiness" value={ats} />
          </div>
        </div>
        {!!review.strengths?.length && (
          <div className="card p-5">
            <div className="eyebrow mb-2 text-accent">Strengths</div>
            <ul className="space-y-1.5 text-sm text-ink-2">
              {review.strengths.map((s) => (
                <li key={s} className="flex gap-2">
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-accent" /> {s}
                </li>
              ))}
            </ul>
          </div>
        )}
        {!!review.target_roles?.length && (
          <div className="card p-5">
            <div className="eyebrow mb-2">Positioned for</div>
            <div className="flex flex-wrap gap-1.5">
              {review.target_roles.map((r) => (
                <span key={r} className="pill pill-primary">
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}
        {!!review.missing_keywords?.length && (
          <div className="card p-5">
            <div className="eyebrow mb-2">Keywords recruiters expect</div>
            <div className="flex flex-wrap gap-1.5">
              {review.missing_keywords.map((k) => (
                <span key={k} className="pill pill-amber">
                  {k}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="card p-5">
        <div className="eyebrow mb-3">Improvements</div>
        {improvements.length === 0 ? (
          <div className="text-sm text-muted">Nothing major. Nice CV.</div>
        ) : (
          <ul className="space-y-3">
            {improvements.map((im, i) => (
              <li key={i} className="surface p-4">
                <div className="flex items-center gap-2">
                  <span className={cn('pill', im.priority === 'high' ? 'pill-warning' : im.priority === 'medium' ? 'pill-amber' : 'pill-muted')}>{im.priority}</span>
                  <span className="text-xs font-semibold text-ink">{im.section}</span>
                </div>
                <div className="mt-2 text-sm text-ink-2">{im.issue}</div>
                <div className="mt-1.5 text-xs leading-relaxed text-muted">
                  <span className="text-accent">Fix:</span> {im.fix}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Gauge({ label, value }: { label: string; value: number }) {
  const color = value >= 75 ? '#64FFDA' : value >= 50 ? '#7EB8FF' : '#FFC857'
  const r = 30
  const c = 2 * Math.PI * r
  return (
    <div className="surface flex flex-col items-center p-3">
      <div className="relative h-[76px] w-[76px]">
        <svg width={76} height={76} className="-rotate-90" aria-hidden="true">
          <circle cx={38} cy={38} r={r} stroke="rgba(26,58,107,0.6)" strokeWidth="6" fill="none" />
          <circle cx={38} cy={38} r={r} stroke={color} strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`} style={{ transition: 'stroke-dasharray 0.8s ease' }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-display text-lg font-bold" style={{ color }}>
          {value}
        </div>
      </div>
      <div className="mt-1 text-[11px] uppercase tracking-wider text-dim">{label}</div>
    </div>
  )
}

function sampleFrom(cv: CvDocument): CvDocument {
  return {
    ...cv,
    summary: 'Software engineering student with hands-on Python and automation experience, shipping LLM-powered tools for freelance clients. Seeking a backend or AI engineering internship.',
    experience: (cv.experience || []).map((e) => ({ ...e, bullets: ['Automated 4 client reporting workflows with Python and n8n, saving ~6 hours/week', 'Built and deployed 2 Claude-API pipelines used daily by 30+ users'] })),
  }
}
