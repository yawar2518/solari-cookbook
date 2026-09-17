'use client'

import { scoreTone } from '@/lib/utils'

export function ScoreRing({ score, size = 56, stroke = 3, showLabel = false }: { score?: number; size?: number; stroke?: number; showLabel?: boolean }) {
  const s = Math.max(0, Math.min(100, Math.round(score ?? 0)))
  const tone = scoreTone(s)
  const r = (size - stroke * 2) / 2
  const c = 2 * Math.PI * r
  const dash = (s / 100) * c
  const fontSize = size >= 64 ? size * 0.28 : size * 0.3

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title={`${s}/100 match`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill={tone.bg} stroke={tone.border} strokeWidth={stroke * 0.5} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone.color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display font-bold leading-none" style={{ color: tone.color, fontSize }}>
          {score == null ? '–' : s}
        </span>
        {showLabel && <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-dim">{tone.label}</span>}
      </div>
    </div>
  )
}
