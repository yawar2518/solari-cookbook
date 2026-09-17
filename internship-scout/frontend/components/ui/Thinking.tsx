'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Claude-style rotating status line. Messages cycle every `interval` ms;
 * when `progress` is supplied the copy also advances with it.
 */
export function ThinkingLine({ messages, interval = 2200, className, progress }: { messages: string[]; interval?: number; className?: string; progress?: number }) {
  const [tick, setTick] = useState(0)
  // Progress-driven mode: the index only ever moves forward. Derived during
  // render (no effect) so it never lags a frame behind the progress bar.
  const target = progress != null ? Math.min(messages.length - 1, Math.floor((progress / 100) * messages.length)) : 0
  const [floor, setFloor] = useState(target)
  if (target > floor) setFloor(target)
  const idx = progress != null ? floor : tick % messages.length

  useEffect(() => {
    if (progress != null) return
    const t = setInterval(() => setTick((i) => i + 1), interval)
    return () => clearInterval(t)
  }, [interval, progress])

  return (
    <div className={cn('flex items-center gap-3 text-sm', className)} aria-live="polite">
      <span className="inline-flex items-center gap-1">
        <span className="pulse-dot" />
        <span className="pulse-dot" />
        <span className="pulse-dot" />
      </span>
      <span key={idx} className="font-display font-medium text-accent fade-up">
        {messages[idx]}
      </span>
    </div>
  )
}

export const PARSE_MESSAGES = [
  'Reading your background...',
  'Inferring your skills...',
  'Weighing your experience level...',
  'Figuring out which roles fit...',
  'Choosing search keywords...',
]

export const SEARCH_MESSAGES = [
  'Queued...',
  'Launching a stealth browser...',
  'Reading live LinkedIn listings...',
  'Collecting local internships...',
  'Removing duplicates...',
  'Matching against your profile...',
  'Ranking by fit...',
  'Writing why each one fits...',
]

export const RESEARCH_MESSAGES = [
  'Searching the web for the company...',
  'Reading their about page...',
  'Guessing the tech stack...',
  'Checking Glassdoor...',
  'Summarising what the role involves...',
]

export const LETTER_MESSAGES = ['Reading the role...', 'Picking your strongest evidence...', 'Drafting three tight paragraphs...']
