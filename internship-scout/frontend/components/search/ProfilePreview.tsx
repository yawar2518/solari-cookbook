'use client'

import { useState } from 'react'
import { ArrowLeft, Check, Pencil, Plus, Radar, X } from 'lucide-react'
import { Spinner } from '@/components/ui/States'
import type { ParsedProfile } from '@/lib/types'
import { cn } from '@/lib/utils'

function ChipEditor({ items, onChange, tone = 'accent', placeholder = 'Add…' }: { items: string[]; onChange: (next: string[]) => void; tone?: 'accent' | 'primary' | 'muted'; placeholder?: string }) {
  const [draft, setDraft] = useState('')
  const cls = tone === 'accent' ? 'pill pill-accent' : tone === 'primary' ? 'pill pill-primary' : 'pill pill-muted'
  const add = () => {
    const v = draft.trim()
    if (!v || items.some((i) => i.toLowerCase() === v.toLowerCase())) {
      setDraft('')
      return
    }
    onChange([...items, v])
    setDraft('')
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map((item) => (
        <span key={item} className={cn(cls, 'pr-1')}>
          {item}
          <button type="button" onClick={() => onChange(items.filter((i) => i !== item))} className="ml-0.5 rounded-full p-0.5 opacity-70 hover:opacity-100" aria-label={`Remove ${item}`}>
            <X size={11} />
          </button>
        </span>
      ))}
      <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-2 py-0.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              add()
            }
          }}
          onBlur={add}
          placeholder={placeholder}
          className="w-20 bg-transparent text-xs text-ink outline-none placeholder:text-dim"
        />
        <button type="button" onClick={add} className="text-dim hover:text-ink" aria-label="Add">
          <Plus size={12} />
        </button>
      </span>
    </div>
  )
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-dim">{label}</span>
      {children}
    </label>
  )
}

const select = 'input-base h-9 px-2.5 text-sm'
const input = 'input-base h-9 text-sm'

export function ProfilePreview({
  profile,
  onChange,
  onConfirm,
  onBack,
  isStarting,
  cached,
  searchesLeft,
}: {
  profile: ParsedProfile
  onChange: (next: ParsedProfile) => void
  onConfirm: (locationOverride: string) => void
  onBack: () => void
  isStarting: boolean
  cached: boolean
  searchesLeft: number | null
}) {
  const [editing, setEditing] = useState(false)
  const [location, setLocation] = useState('')

  const p = profile
  const set = <K extends keyof ParsedProfile>(key: K, value: ParsedProfile[K]) => onChange({ ...p, [key]: value })
  const setPref = (key: string, value: string | null) => set('preferences', { ...(p.preferences || {}), [key]: value || null })
  const setEdu = (key: string, value: string) => set('education', { ...(p.education || {}), [key]: value || null })

  const roles = p.inferred_roles || []
  const confidence = (c?: string) => (c === 'high' ? 'text-accent' : c === 'medium' ? 'text-sky' : 'text-muted')

  return (
    <div className="fade-up">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <div className="eyebrow text-accent">Step 2 of 3 {cached && <span className="ml-2 pill pill-muted normal-case tracking-normal">from your saved profile</span>}</div>
          <h1 className="mt-2 text-3xl font-bold">Here&apos;s how fyt sees you.</h1>
          <p className="mt-2 text-muted">Confirm it, or fix anything we got wrong — the search is only as good as this.</p>
        </div>
        <button className={cn('btn h-9 text-xs', editing ? 'btn-accent' : 'btn-ghost')} onClick={() => setEditing((e) => !e)} type="button">
          {editing ? (
            <>
              <Check size={14} /> Done editing
            </>
          ) : (
            <>
              <Pencil size={14} /> Edit profile
            </>
          )}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <div className="card p-5">
            <div className="eyebrow mb-2">Summary</div>
            {editing ? (
              <textarea className="input-base min-h-[80px] text-sm" value={p.summary || ''} onChange={(e) => set('summary', e.target.value)} />
            ) : (
              <p className="text-sm leading-relaxed text-ink-2">{p.summary || '—'}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card p-5">
              <div className="eyebrow mb-3">Education</div>
              {editing ? (
                <div className="space-y-2">
                  <Field label="Field">
                    <input className={input} value={p.education?.field || ''} onChange={(e) => setEdu('field', e.target.value)} />
                  </Field>
                  <Field label="Level">
                    <input className={input} value={p.education?.level || ''} onChange={(e) => setEdu('level', e.target.value)} placeholder="undergraduate, bootcamp…" />
                  </Field>
                  <Field label="Year / semester">
                    <input className={input} value={p.education?.year || ''} onChange={(e) => setEdu('year', e.target.value)} />
                  </Field>
                  <Field label="Institution">
                    <input className={input} value={p.education?.institution || ''} onChange={(e) => setEdu('institution', e.target.value)} />
                  </Field>
                </div>
              ) : (
                <>
                  <div className="font-display text-sm font-semibold text-ink">{p.education?.field || 'Not specified'}</div>
                  <div className="mt-1 text-xs text-muted">
                    {[p.education?.year, p.education?.level, p.education?.institution].filter(Boolean).join(' · ') || '—'}
                  </div>
                </>
              )}
            </div>

            <div className="card p-5">
              <div className="eyebrow mb-3">Experience</div>
              {editing ? (
                <div className="space-y-2">
                  <Field label="Level">
                    <select className={select} value={p.experience?.level || ''} onChange={(e) => set('experience', { ...(p.experience || {}), level: e.target.value })}>
                      <option value="">—</option>
                      <option value="no experience">No experience</option>
                      <option value="beginner">Beginner</option>
                      <option value="some experience">Some experience</option>
                      <option value="intermediate">Intermediate</option>
                    </select>
                  </Field>
                  <Field label="Highlights">
                    <ChipEditor items={p.experience?.highlights || []} onChange={(v) => set('experience', { ...(p.experience || {}), highlights: v })} tone="muted" placeholder="Add a project…" />
                  </Field>
                </div>
              ) : (
                <>
                  <div className="font-display text-sm font-semibold capitalize text-ink">{p.experience?.level || 'Not specified'}</div>
                  <ul className="mt-2 space-y-1 text-xs text-muted">
                    {(p.experience?.highlights || []).slice(0, 4).map((h) => (
                      <li key={h} className="flex gap-1.5">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" /> {h}
                      </li>
                    ))}
                    {!p.experience?.highlights?.length && <li>No highlights yet</li>}
                  </ul>
                </>
              )}
            </div>
          </div>

          <div className="card p-5">
            <div className="eyebrow mb-3">Skills</div>
            <div className="mb-1.5 text-[11px] text-dim">Confirmed — you said these</div>
            {editing ? (
              <ChipEditor items={p.skills?.confirmed || []} onChange={(v) => set('skills', { ...(p.skills || {}), confirmed: v })} tone="accent" />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {(p.skills?.confirmed || []).map((s) => (
                  <span key={s} className="pill pill-accent">
                    {s}
                  </span>
                ))}
                {!p.skills?.confirmed?.length && <span className="text-xs text-dim">None detected</span>}
              </div>
            )}
            <div className="mb-1.5 mt-4 text-[11px] text-dim">Inferred — fyt read these between the lines</div>
            {editing ? (
              <ChipEditor items={p.skills?.inferred || []} onChange={(v) => set('skills', { ...(p.skills || {}), inferred: v })} tone="primary" />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {(p.skills?.inferred || []).map((s) => (
                  <span key={s} className="pill pill-primary">
                    {s}
                  </span>
                ))}
                {!p.skills?.inferred?.length && <span className="text-xs text-dim">None inferred</span>}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <div className="eyebrow mb-3">Roles you could fit</div>
            <div className="space-y-3">
              {roles.map((r, i) => (
                <div key={`${r.role}-${i}`} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {editing ? (
                      <input
                        className={input}
                        value={r.role}
                        onChange={(e) => set('inferred_roles', roles.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))}
                      />
                    ) : (
                      <div className="text-sm font-medium text-ink">{r.role}</div>
                    )}
                    {r.reasoning && !editing && <div className="mt-0.5 text-xs text-muted">{r.reasoning}</div>}
                  </div>
                  {editing ? (
                    <button type="button" className="mt-2 text-dim hover:text-warning" onClick={() => set('inferred_roles', roles.filter((_, j) => j !== i))} aria-label="Remove role">
                      <X size={14} />
                    </button>
                  ) : (
                    <span className={cn('mt-0.5 shrink-0 text-[11px] font-semibold uppercase tracking-wider', confidence(r.confidence))}>{r.confidence}</span>
                  )}
                </div>
              ))}
              {editing && (
                <button type="button" className="btn btn-ghost h-8 w-full text-xs" onClick={() => set('inferred_roles', [...roles, { role: 'New role', confidence: 'medium', reasoning: '' }])}>
                  <Plus size={13} /> Add a role
                </button>
              )}
              {!roles.length && !editing && <div className="text-xs text-dim">No roles inferred</div>}
            </div>
          </div>

          <div className="card p-5">
            <div className="eyebrow mb-3">Preferences</div>
            {editing ? (
              <div className="grid grid-cols-2 gap-2">
                <Field label="Job type">
                  <select className={select} value={p.preferences?.job_type || ''} onChange={(e) => setPref('job_type', e.target.value)}>
                    <option value="">Any</option>
                    <option value="internship">Internship</option>
                    <option value="full-time">Full-time</option>
                    <option value="part-time">Part-time</option>
                  </select>
                </Field>
                <Field label="Work mode">
                  <select className={select} value={p.preferences?.location_type || ''} onChange={(e) => setPref('location_type', e.target.value)}>
                    <option value="">Any</option>
                    <option value="remote">Remote</option>
                    <option value="onsite">Onsite</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </Field>
                <Field label="City">
                  <input className={input} value={p.preferences?.city || ''} onChange={(e) => setPref('city', e.target.value)} />
                </Field>
                <Field label="Country">
                  <input className={input} value={p.preferences?.country || ''} onChange={(e) => setPref('country', e.target.value)} />
                </Field>
              </div>
            ) : (
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <dt className="text-dim">Type</dt>
                <dd className="capitalize text-ink-2">{p.preferences?.job_type || 'Any'}</dd>
                <dt className="text-dim">Mode</dt>
                <dd className="capitalize text-ink-2">{p.preferences?.location_type || 'Any'}</dd>
                <dt className="text-dim">Where</dt>
                <dd className="text-ink-2">{[p.preferences?.city, p.preferences?.country].filter(Boolean).join(', ') || (p.preferences?.location_scope === 'global' ? 'Anywhere' : 'Not specified')}</dd>
              </dl>
            )}
          </div>

          <div className="card p-5">
            <div className="eyebrow mb-3">Search keywords</div>
            {editing ? (
              <ChipEditor items={p.search_keywords?.global || []} onChange={(v) => set('search_keywords', { ...(p.search_keywords || {}), global: v })} tone="muted" placeholder="Add keyword…" />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {[...(p.search_keywords?.global || []).slice(0, 2), ...(p.search_keywords?.local || []).slice(0, 1)].map((k) => (
                  <span key={k} className="pill pill-muted">
                    {k}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-3 text-[11px] leading-relaxed text-dim">We search the first three. Edit them if they miss the mark.</div>
          </div>

          <div className="card p-5">
            <Field label="Location for this search (optional override)">
              <input className={input} placeholder="e.g. Remote, or Karachi, Pakistan" value={location} onChange={(e) => setLocation(e.target.value)} />
            </Field>
            <button className="btn btn-primary mt-4 h-11 w-full" onClick={() => onConfirm(location)} disabled={isStarting} type="button">
              {isStarting ? (
                <>
                  <Spinner size={16} /> Starting…
                </>
              ) : (
                <>
                  <Radar size={16} /> Looks right — find my matches
                </>
              )}
            </button>
            <div className="mt-2 text-center text-[11px] text-dim">
              {searchesLeft == null ? 'Unlimited searches on Pro' : `Uses 1 search credit · ${searchesLeft} left today`}
            </div>
            <button className="btn btn-ghost mt-2 h-9 w-full text-xs" onClick={onBack} type="button" disabled={isStarting}>
              <ArrowLeft size={13} /> Edit my description
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
