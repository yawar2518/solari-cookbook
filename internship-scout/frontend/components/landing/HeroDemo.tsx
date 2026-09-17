'use client'

import { useEffect, useState } from 'react'
import { ScoreRing } from '@/components/ui/ScoreRing'

const SCRIPT =
  "7th semester Software Engineering student. Python, n8n automations, worked with the Claude API, some freelancing on Upwork building LLM pipelines. Not sure what role I want — anything AI or backend. Lahore, open to remote."

const CHIPS = [
  { label: 'Python', kind: 'confirmed' },
  { label: 'LLM pipelines', kind: 'confirmed' },
  { label: 'n8n', kind: 'confirmed' },
  { label: 'REST APIs', kind: 'inferred' },
  { label: 'Prompt engineering', kind: 'inferred' },
  { label: 'Git', kind: 'inferred' },
]

const ROLES = [
  { role: 'AI Automation Engineer Intern', confidence: 'high' },
  { role: 'Backend Developer Intern', confidence: 'medium' },
  { role: 'Junior LLM Engineer', confidence: 'medium' },
]

const JOBS = [
  { score: 91, title: 'AI Automation Engineer (Intern)', company: 'QuantumBasel', location: 'Remote', why: 'Your n8n + Claude API work is exactly what they list.' },
  { score: 78, title: 'Python Backend Intern', company: 'Zenithbyte', location: 'Lahore · Hybrid', why: 'Strong on Python; Django is the one gap.' },
  { score: 56, title: 'Data Scientist Intern', company: 'Haystack', location: 'Remote', why: 'Partial — ML depth is a stretch for now.' },
]

type Phase = 'typing' | 'parsing' | 'profile' | 'matching' | 'results'

export function HeroDemo() {
  const [typed, setTyped] = useState('')
  const [phase, setPhase] = useState<Phase>('typing')

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    const run = async () => {
      const wait = (ms: number) => new Promise<void>((res) => (timer = setTimeout(res, ms)))
      for (;;) {
        if (cancelled) return
        setPhase('typing')
        setTyped('')
        for (let i = 0; i <= SCRIPT.length; i += 2) {
          if (cancelled) return
          setTyped(SCRIPT.slice(0, i))
          await wait(14)
        }
        setTyped(SCRIPT)
        await wait(600)
        setPhase('parsing')
        await wait(1600)
        setPhase('profile')
        await wait(2600)
        setPhase('matching')
        await wait(1800)
        setPhase('results')
        await wait(6500)
      }
    }
    void run()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  return (
    <div className="relative min-w-0">
      <div className="card overflow-hidden p-0 shadow-glow" style={{ background: 'rgba(13,31,60,0.85)' }}>
        <div className="flex items-center gap-2 border-b border-line-soft px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-accent/70" />
          <span className="ml-3 text-[11px] text-dim">fyt · find your fit</span>
          <span className="ml-auto text-[11px] text-dim">{phaseLabel(phase)}</span>
        </div>

        <div className="grid gap-0 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          {/* Left: what the user types */}
          <div className="min-w-0 border-b border-line-soft p-4 md:border-b-0 md:border-r">
            <div className="eyebrow mb-2">You write</div>
            <div className="surface min-h-[150px] p-3 text-[13px] leading-relaxed text-ink-2">
              {typed}
              {phase === 'typing' && <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 bg-accent animate-blink" />}
            </div>
            <div className="mt-3 min-h-[92px]">
              {(phase === 'profile' || phase === 'matching' || phase === 'results') && (
                <div className="fade-up">
                  <div className="eyebrow mb-1.5">fyt infers</div>
                  <div className="flex flex-wrap gap-1.5">
                    {CHIPS.map((c) => (
                      <span key={c.label} className={c.kind === 'confirmed' ? 'pill pill-accent' : 'pill pill-primary'}>
                        {c.label}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 space-y-1">
                    {ROLES.map((r) => (
                      <div key={r.role} className="flex items-center justify-between text-[12px]">
                        <span className="text-ink-2">{r.role}</span>
                        <span className={r.confidence === 'high' ? 'text-accent' : 'text-sky'}>{r.confidence}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {phase === 'parsing' && (
                <div className="flex items-center gap-2 text-[12px] text-accent">
                  <span className="pulse-dot" />
                  <span className="pulse-dot" />
                  <span className="pulse-dot" />
                  <span className="ml-1 font-display">Inferring skills and roles…</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: matches */}
          <div className="min-w-0 p-4">
            <div className="eyebrow mb-2">Ranked for you</div>
            {phase === 'results' ? (
              <div className="space-y-2">
                {JOBS.map((j, i) => (
                  <div key={j.title} className="surface flex items-center gap-3 p-2.5 fade-up" style={{ animationDelay: `${i * 0.12}s` }}>
                    <ScoreRing score={j.score} size={40} stroke={2.5} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-ink">{j.title}</div>
                      <div className="truncate text-[11px] text-muted">
                        {j.company} · {j.location}
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-ink-2/80">{j.why}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="relative space-y-2 overflow-hidden">
                {phase === 'matching' && <div className="scan-line absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent animate-scan" />}
                {[0, 1, 2].map((i) => (
                  <div key={i} className="surface flex items-center gap-3 p-2.5">
                    <div className="skeleton h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <div className="skeleton h-3 w-2/3" />
                      <div className="skeleton h-2.5 w-1/2" />
                    </div>
                  </div>
                ))}
                <div className="pt-1 text-[11px] text-dim">
                  {phase === 'matching' ? 'Reading live listings, then ranking by fit…' : 'Waiting for your profile…'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[28px] bg-primary/10 blur-3xl" aria-hidden="true" />
    </div>
  )
}

function phaseLabel(phase: Phase) {
  switch (phase) {
    case 'typing':
      return 'describing yourself'
    case 'parsing':
      return 'reading your background'
    case 'profile':
      return 'profile ready'
    case 'matching':
      return 'matching live listings'
    default:
      return '3 matches · ranked'
  }
}
