'use client'

import { useEffect, useRef, useState } from 'react'
import { Building2, Cpu, ExternalLink, Flag, Lightbulb, MessageCircle, Star, Users } from 'lucide-react'
import { useUser } from '@/components/providers/UserProvider'
import { ErrorState, LockedOverlay, Skeleton } from '@/components/ui/States'
import { RESEARCH_MESSAGES, ThinkingLine } from '@/components/ui/Thinking'
import { api, errorMessage } from '@/lib/api'
import type { CompanyResearch } from '@/lib/types'

export function CompanyResearchPanel({ jobId, company, descriptionReady }: { jobId: string; company: string; descriptionReady: boolean }) {
  const { me } = useUser()
  const isPro = me?.user.plan === 'pro'
  const [research, setResearch] = useState<CompanyResearch | null>(null)
  const [error, setError] = useState<string | null>(null)
  const startedRef = useRef(false)

  const load = () =>
    api
      .jobResearch(jobId)
      .then((res) => {
        if (!res.locked) setResearch(res.research)
      })
      .catch((err: unknown) => setError(errorMessage(err)))

  useEffect(() => {
    // Wait for the description so the research has real input, then fetch once.
    if (isPro && descriptionReady && !startedRef.current) {
      startedRef.current = true
      void load()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPro, descriptionReady])

  const retry = () => {
    setError(null)
    void load()
  }

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="eyebrow text-accent">Company research</div>
          <h2 className="mt-0.5 text-lg font-semibold">{company}</h2>
        </div>
        {isPro && research?.cached && <span className="pill pill-muted">cached</span>}
      </div>

      {!isPro ? (
        <LockedOverlay title="Full company research is a Pro feature" body="Size, tech stack, day-to-day, culture signals, Glassdoor rating and interview tips — researched live for each job.">
          <ResearchBody r={PLACEHOLDER} />
        </LockedOverlay>
      ) : error ? (
        <ErrorState title="Research failed" body={error} onRetry={retry} className="py-6" />
      ) : !research ? (
        <div className="space-y-3">
          <ThinkingLine messages={RESEARCH_MESSAGES} />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <ResearchBody r={research} />
      )}
    </div>
  )
}

function ResearchBody({ r }: { r: CompanyResearch }) {
  return (
    <div className="space-y-4 text-sm">
      {r.company_overview && <p className="leading-relaxed text-ink-2">{r.company_overview}</p>}

      <div className="grid gap-2 sm:grid-cols-3">
        <Stat icon={<Building2 size={14} />} label="Type" value={r.company_type || 'unknown'} />
        <Stat icon={<Users size={14} />} label="Size" value={r.company_size || 'unknown'} />
        <Stat
          icon={<Star size={14} />}
          label="Glassdoor"
          value={r.glassdoor_rating ? `${r.glassdoor_rating} / 5` : 'not found'}
          sub={r.glassdoor_note || undefined}
        />
      </div>

      {!!r.tech_stack?.length && (
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-sky">
            <Cpu size={13} /> Tech stack
          </div>
          <div className="flex flex-wrap gap-1.5">
            {r.tech_stack.map((t) => (
              <span key={t} className="pill pill-primary">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {!!r.day_to_day?.length && (
        <Section icon={<MessageCircle size={13} />} title="What the role involves day to day" items={r.day_to_day} />
      )}
      {!!r.culture_signals?.length && <Section icon={<Users size={13} />} title="Culture signals" items={r.culture_signals} />}
      {!!r.interview_tips?.length && <Section icon={<Lightbulb size={13} />} title="Interview tips" items={r.interview_tips} tone="accent" />}
      {!!r.red_flags?.length && <Section icon={<Flag size={13} />} title="Watch out for" items={r.red_flags} tone="warning" />}

      {!!r.sources?.length && (
        <div className="text-[11px] text-dim">
          Sources:{' '}
          {r.sources.slice(0, 4).map((s, i) => (
            <a key={s} href={s} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-sky hover:underline">
              {i > 0 && <span className="mr-1 text-dim">·</span>}
              {hostname(s)} <ExternalLink size={9} />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="surface p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-dim">
        {icon} {label}
      </div>
      <div className="mt-1 font-display text-sm font-semibold capitalize text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted">{sub}</div>}
    </div>
  )
}

function Section({ icon, title, items, tone = 'sky' }: { icon: React.ReactNode; title: string; items: string[]; tone?: 'sky' | 'accent' | 'warning' }) {
  const color = tone === 'accent' ? 'text-accent' : tone === 'warning' ? 'text-warning' : 'text-sky'
  return (
    <div>
      <div className={`mb-1.5 flex items-center gap-1.5 text-xs font-semibold ${color}`}>
        {icon} {title}
      </div>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it} className="flex gap-2 text-ink-2">
            <span className={`mt-2 h-1 w-1 shrink-0 rounded-full ${tone === 'warning' ? 'bg-warning' : 'bg-accent'}`} />
            <span className="leading-relaxed">{it}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

const PLACEHOLDER: CompanyResearch = {
  company_overview: 'A mid-sized product company building developer tooling for fintech clients, with engineering teams across two time zones.',
  company_type: 'scale-up',
  company_size: '120–200 employees',
  glassdoor_rating: '4.2',
  glassdoor_note: 'Reviews praise mentorship for interns; hours can spike near releases.',
  tech_stack: ['Python', 'FastAPI', 'PostgreSQL', 'React', 'AWS'],
  day_to_day: ['Ship small backend features with a senior reviewer', 'Write integration tests for the payments service', 'Join a daily 15-minute stand-up'],
  culture_signals: ['Remote-friendly with async updates', 'Values written communication', 'Fast feedback loops'],
  interview_tips: ['Bring one project you can talk through end to end', 'Expect a short take-home', 'Ask about the intern mentorship structure'],
  red_flags: [],
  sources: ['https://example.com'],
}
