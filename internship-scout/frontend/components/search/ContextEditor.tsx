'use client'

import { useRef, useState } from 'react'
import { ArrowRight, Wand2 } from 'lucide-react'
import { ThinkingLine, PARSE_MESSAGES } from '@/components/ui/Thinking'
import { EXAMPLE_CONTEXTS, cn } from '@/lib/utils'

const MIN = 20
const MAX = 6000

export function ContextEditor({
  initialText,
  isParsing,
  onSubmit,
  hasExistingProfile,
  onUseExisting,
}: {
  initialText: string
  isParsing: boolean
  onSubmit: (text: string) => void
  hasExistingProfile: boolean
  onUseExisting: () => void
}) {
  const [text, setText] = useState(initialText)
  const [touched, setTouched] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)

  // Re-seed the editor when the saved context arrives after first render.
  const [seededFrom, setSeededFrom] = useState(initialText)
  if (initialText !== seededFrom) {
    setSeededFrom(initialText)
    setText(initialText)
  }

  const len = text.trim().length
  const valid = len >= MIN && len <= MAX

  const submit = () => {
    setTouched(true)
    if (!valid) {
      ref.current?.focus()
      return
    }
    onSubmit(text.trim())
  }

  return (
    <div className="fade-up">
      <div className="mb-8 max-w-2xl">
        <div className="eyebrow text-accent">Step 1 of 3</div>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Tell us about yourself in plain English.</h1>
        <p className="mt-3 text-muted">
          Your semester, what you&apos;ve built, freelance gigs, what you&apos;re unsure about, where you want to work. fyt infers the rest —
          including roles you might not have considered.
        </p>
      </div>

      <div className="card relative overflow-hidden p-1">
        {isParsing && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-base/85 backdrop-blur-sm">
            <div className="relative h-16 w-16">
              <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
              <div className="absolute inset-0 animate-spin-slow rounded-full border-2 border-transparent border-t-accent" />
              <Wand2 size={20} className="absolute inset-0 m-auto text-accent" />
            </div>
            <ThinkingLine messages={PARSE_MESSAGES} />
          </div>
        )}
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
          disabled={isParsing}
          rows={9}
          maxLength={MAX}
          placeholder="I'm in my 5th semester of Computer Science at ... I've built ... I know ... I'm not sure whether I want ... Ideally remote, or onsite in ..."
          className="w-full resize-none rounded-[11px] bg-transparent px-5 py-4 text-[15px] leading-relaxed text-ink outline-none placeholder:text-dim"
          aria-label="Describe yourself"
        />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-4 py-3">
          <div className={cn('text-xs', touched && !valid ? 'text-warning' : 'text-dim')}>
            {len < MIN ? `${MIN - len} more characters to go` : `${len.toLocaleString()} / ${MAX.toLocaleString()}`}
            <span className="ml-3 hidden text-dim sm:inline">Ctrl + Enter to continue</span>
          </div>
          <div className="flex items-center gap-2">
            {hasExistingProfile && (
              <button className="btn btn-ghost h-9 text-xs" onClick={onUseExisting} disabled={isParsing} type="button">
                Use my saved profile
              </button>
            )}
            <button className="btn btn-primary h-9" onClick={submit} disabled={isParsing} type="button">
              Read my profile <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-2 text-xs text-dim">Not sure what to write? Start from one of these and edit:</div>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_CONTEXTS.map((ex) => (
            <button
              key={ex.label}
              type="button"
              onClick={() => {
                setText(ex.text)
                ref.current?.focus()
              }}
              className="pill pill-primary cursor-pointer transition hover:bg-primary/25"
              disabled={isParsing}
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
