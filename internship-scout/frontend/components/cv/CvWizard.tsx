'use client'

import { useState } from 'react'
import { ArrowLeft, ArrowRight, Plus, Trash2, Wand2 } from 'lucide-react'
import { useUser } from '@/components/providers/UserProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { InlineError, ProgressBar, Spinner } from '@/components/ui/States'
import { ThinkingLine } from '@/components/ui/Thinking'
import { api, errorMessage } from '@/lib/api'
import type { CvDocument, CvForm } from '@/lib/types'
import { cn } from '@/lib/utils'
import { CvPreview } from './CvPreview'

const STEPS = ['Personal', 'Education', 'Experience', 'Skills', 'Projects', 'Achievements'] as const
const GEN_MESSAGES = ['Reading your notes...', 'Turning notes into action-verb bullets...', 'Ordering sections for ATS...', 'Tightening to one page...']

const emptyForm = (name?: string | null, email?: string | null): CvForm => ({
  personal: { name: name || '', email: email || '', phone: '', location: '', linkedin: '', github: '', website: '' },
  summary: '',
  education: [{ degree: '', institution: '', location: '', start: '', end: '', details: '' }],
  experience: [],
  skills: '',
  projects: [{ name: '', tech: '', link: '', description: '' }],
  achievements: '',
  target_role: '',
})

const input = 'input-base h-9 text-sm'
const area = 'input-base min-h-[84px] text-sm'

function L({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between text-[11px] uppercase tracking-wider text-dim">
        {label}
        {hint && <span className="normal-case tracking-normal text-dim/80">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

export function CvWizard({ existing, onGenerated }: { existing: CvDocument | null; onGenerated: (cv: CvDocument) => void }) {
  const { me, refresh } = useUser()
  const toast = useToast()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<CvForm>(() => emptyForm(me?.user.full_name, me?.user.email))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CvDocument | null>(existing)
  const [saved, setSaved] = useState(!!existing)

  const set = <K extends keyof CvForm>(key: K, value: CvForm[K]) => setForm((f) => ({ ...f, [key]: value }))
  const setPersonal = (key: keyof CvForm['personal'], value: string) => set('personal', { ...form.personal, [key]: value })

  const updateAt = <T,>(list: T[], i: number, patch: Partial<T>) => list.map((x, j) => (j === i ? { ...x, ...patch } : x))
  const removeAt = <T,>(list: T[], i: number) => list.filter((_, j) => j !== i)

  const validate = (): string | null => {
    if (step === 0) {
      if (!form.personal.name.trim()) return 'Your name is required.'
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.personal.email)) return 'Enter a valid email.'
    }
    if (step === 1 && !form.education.some((e) => e.degree.trim() || e.institution.trim())) return 'Add at least one education entry.'
    if (step === 3 && form.skills.trim().length < 3) return 'List a few skills.'
    return null
  }

  const next = () => {
    const v = validate()
    if (v) {
      setError(v)
      return
    }
    setError(null)
    setStep((s) => Math.min(STEPS.length - 1, s + 1))
  }

  const generate = async () => {
    const v = validate()
    if (v) {
      setError(v)
      return
    }
    setError(null)
    setBusy(true)
    try {
      const res = await api.generateCv(form)
      setResult(res.cv)
      setSaved(true)
      onGenerated(res.cv)
      toast.success('CV generated', 'Review it, then download the PDF.')
      void refresh()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (result) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-muted">Here&apos;s your ATS-ready CV. Edit the form and regenerate any time.</div>
          <button className="btn btn-ghost h-9 text-xs" onClick={() => setResult(null)} type="button">
            <ArrowLeft size={13} /> Back to the form
          </button>
        </div>
        <CvPreview
          cv={result}
          title="Generated CV"
          saved={saved}
          onSave={async () => {
            await api.saveGeneratedCv(result)
            setSaved(true)
            void refresh()
          }}
        />
      </div>
    )
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[200px_1fr]">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <ProgressBar value={((step + 1) / STEPS.length) * 100} className="mb-4" tone="accent" />
        <ol className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-1.5">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => i < step && setStep(i)}
                className={cn(
                  'flex w-full items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-xs font-medium transition',
                  i === step ? 'bg-primary-soft text-ink' : i < step ? 'text-accent hover:bg-surface-2' : 'text-dim',
                )}
              >
                <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]', i === step ? 'border-accent text-accent' : i < step ? 'border-accent/50 bg-accent-soft text-accent' : 'border-line')}>{i + 1}</span>
                {s}
              </button>
            </li>
          ))}
        </ol>
      </aside>

      <div className="card relative p-5 sm:p-6">
        {busy && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-card bg-base/85 backdrop-blur-sm">
            <Wand2 size={22} className="text-accent" />
            <ThinkingLine messages={GEN_MESSAGES} />
          </div>
        )}
        <div className="mb-5">
          <div className="eyebrow text-accent">
            Step {step + 1} of {STEPS.length}
          </div>
          <h2 className="mt-1 text-xl font-semibold">{STEPS[step]}</h2>
        </div>

        {step === 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <L label="Full name">
              <input className={input} value={form.personal.name} onChange={(e) => setPersonal('name', e.target.value)} />
            </L>
            <L label="Email">
              <input className={input} type="email" value={form.personal.email} onChange={(e) => setPersonal('email', e.target.value)} />
            </L>
            <L label="Phone">
              <input className={input} value={form.personal.phone} onChange={(e) => setPersonal('phone', e.target.value)} placeholder="+92 3xx xxxxxxx" />
            </L>
            <L label="Location">
              <input className={input} value={form.personal.location} onChange={(e) => setPersonal('location', e.target.value)} placeholder="Lahore, Pakistan" />
            </L>
            <L label="LinkedIn" hint="optional">
              <input className={input} value={form.personal.linkedin} onChange={(e) => setPersonal('linkedin', e.target.value)} placeholder="linkedin.com/in/…" />
            </L>
            <L label="GitHub" hint="optional">
              <input className={input} value={form.personal.github} onChange={(e) => setPersonal('github', e.target.value)} placeholder="github.com/…" />
            </L>
            <div className="sm:col-span-2">
              <L label="Target role" hint="helps Claude choose keywords">
                <input className={input} value={form.target_role} onChange={(e) => set('target_role', e.target.value)} placeholder="e.g. Backend Developer Intern" />
              </L>
            </div>
            <div className="sm:col-span-2">
              <L label="Summary in your own words" hint="rough is fine">
                <textarea className={area} value={form.summary} onChange={(e) => set('summary', e.target.value)} placeholder="Who you are, what you've built, what you're looking for." />
              </L>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            {form.education.map((e, i) => (
              <div key={i} className="surface relative grid gap-3 p-4 sm:grid-cols-2">
                <L label="Degree">
                  <input className={input} value={e.degree} onChange={(ev) => set('education', updateAt(form.education, i, { degree: ev.target.value }))} placeholder="BS Software Engineering" />
                </L>
                <L label="Institution">
                  <input className={input} value={e.institution} onChange={(ev) => set('education', updateAt(form.education, i, { institution: ev.target.value }))} />
                </L>
                <L label="Start">
                  <input className={input} value={e.start} onChange={(ev) => set('education', updateAt(form.education, i, { start: ev.target.value }))} placeholder="Sep 2022" />
                </L>
                <L label="End / expected">
                  <input className={input} value={e.end} onChange={(ev) => set('education', updateAt(form.education, i, { end: ev.target.value }))} placeholder="Jun 2026" />
                </L>
                <div className="sm:col-span-2">
                  <L label="Details" hint="GPA, coursework, honours">
                    <input className={input} value={e.details} onChange={(ev) => set('education', updateAt(form.education, i, { details: ev.target.value }))} />
                  </L>
                </div>
                {form.education.length > 1 && (
                  <button type="button" className="absolute right-2 top-2 text-dim hover:text-warning" onClick={() => set('education', removeAt(form.education, i))} aria-label="Remove">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="btn btn-ghost h-9 text-xs" onClick={() => set('education', [...form.education, { degree: '', institution: '', location: '', start: '', end: '', details: '' }])}>
              <Plus size={13} /> Add education
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-xs text-muted">Internships, part-time jobs, freelance, volunteering. Nothing yet? Skip this — projects carry a student CV.</p>
            {form.experience.map((x, i) => (
              <div key={i} className="surface relative grid gap-3 p-4 sm:grid-cols-2">
                <L label="Title">
                  <input className={input} value={x.title} onChange={(ev) => set('experience', updateAt(form.experience, i, { title: ev.target.value }))} placeholder="Freelance Automation Developer" />
                </L>
                <L label="Company / client">
                  <input className={input} value={x.company} onChange={(ev) => set('experience', updateAt(form.experience, i, { company: ev.target.value }))} placeholder="Upwork clients" />
                </L>
                <L label="Start">
                  <input className={input} value={x.start} onChange={(ev) => set('experience', updateAt(form.experience, i, { start: ev.target.value }))} placeholder="Jan 2025" />
                </L>
                <L label="End">
                  <input className={input} value={x.end} onChange={(ev) => set('experience', updateAt(form.experience, i, { end: ev.target.value }))} placeholder="Present" />
                </L>
                <div className="sm:col-span-2">
                  <L label="What you did" hint="numbers help: users, hours saved, % faster">
                    <textarea className={area} value={x.description} onChange={(ev) => set('experience', updateAt(form.experience, i, { description: ev.target.value }))} />
                  </L>
                </div>
                <button type="button" className="absolute right-2 top-2 text-dim hover:text-warning" onClick={() => set('experience', removeAt(form.experience, i))} aria-label="Remove">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-ghost h-9 text-xs" onClick={() => set('experience', [...form.experience, { title: '', company: '', location: '', start: '', end: '', description: '' }])}>
              <Plus size={13} /> Add experience
            </button>
          </div>
        )}

        {step === 3 && (
          <L label="Skills" hint="comma-separated, or grouped by line">
            <textarea className="input-base min-h-[140px] text-sm" value={form.skills} onChange={(e) => set('skills', e.target.value)} placeholder={'Languages: Python, TypeScript, C++\nFrameworks: FastAPI, React\nTools: Git, Docker, n8n'} />
          </L>
        )}

        {step === 4 && (
          <div className="space-y-4">
            {form.projects.map((p, i) => (
              <div key={i} className="surface relative grid gap-3 p-4 sm:grid-cols-2">
                <L label="Project name">
                  <input className={input} value={p.name} onChange={(ev) => set('projects', updateAt(form.projects, i, { name: ev.target.value }))} />
                </L>
                <L label="Tech used">
                  <input className={input} value={p.tech} onChange={(ev) => set('projects', updateAt(form.projects, i, { tech: ev.target.value }))} placeholder="Next.js, FastAPI, Supabase" />
                </L>
                <div className="sm:col-span-2">
                  <L label="Link" hint="optional">
                    <input className={input} value={p.link} onChange={(ev) => set('projects', updateAt(form.projects, i, { link: ev.target.value }))} placeholder="github.com/you/project" />
                  </L>
                </div>
                <div className="sm:col-span-2">
                  <L label="What it does and what you built">
                    <textarea className={area} value={p.description} onChange={(ev) => set('projects', updateAt(form.projects, i, { description: ev.target.value }))} />
                  </L>
                </div>
                {form.projects.length > 1 && (
                  <button type="button" className="absolute right-2 top-2 text-dim hover:text-warning" onClick={() => set('projects', removeAt(form.projects, i))} aria-label="Remove">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="btn btn-ghost h-9 text-xs" onClick={() => set('projects', [...form.projects, { name: '', tech: '', link: '', description: '' }])}>
              <Plus size={13} /> Add project
            </button>
          </div>
        )}

        {step === 5 && (
          <L label="Achievements, certifications, leadership" hint="one per line, optional">
            <textarea className="input-base min-h-[140px] text-sm" value={form.achievements} onChange={(e) => set('achievements', e.target.value)} placeholder={'Dean’s list, Spring 2025\nGoogle Data Analytics certificate\nLed a 4-person team to 2nd place at a 24h hackathon'} />
          </L>
        )}

        {error && <InlineError message={error} className="mt-4" />}

        <div className="mt-6 flex items-center justify-between border-t border-line-soft pt-4">
          <button type="button" className="btn btn-ghost h-9 text-xs" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || busy}>
            <ArrowLeft size={13} /> Back
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn btn-primary h-9 text-xs" onClick={next} disabled={busy}>
              Continue <ArrowRight size={13} />
            </button>
          ) : (
            <button type="button" className="btn btn-accent h-9 text-xs" onClick={generate} disabled={busy}>
              {busy ? <Spinner size={13} /> : <Wand2 size={13} />} Generate my CV
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
