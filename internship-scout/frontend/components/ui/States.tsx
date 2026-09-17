'use client'

import Link from 'next/link'
import { AlertTriangle, Lock, RefreshCw, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden="true" />
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card p-5">
      <div className="flex items-start gap-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2.5">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
          {Array.from({ length: lines }).map((_, i) => (
            <Skeleton key={i} className={cn('h-3', i % 2 ? 'w-5/6' : 'w-full')} />
          ))}
        </div>
      </div>
    </div>
  )
}

export function Spinner({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={cn('animate-spin-slow', className)} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="rgba(45,107,228,0.25)" strokeWidth="2.5" fill="none" />
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" fill="none" strokeDasharray="20 50" strokeLinecap="round" />
    </svg>
  )
}

export function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      <span className="pulse-dot" />
      <span className="pulse-dot" />
      <span className="pulse-dot" />
    </span>
  )
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: React.ReactNode
  title: string
  body?: string
  action?: { label: string; href?: string; onClick?: () => void }
  className?: string
}) {
  return (
    <div className={cn('card flex flex-col items-center px-6 py-12 text-center', className)}>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-sky">{icon ?? <Sparkles size={22} />}</div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {body && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{body}</p>}
      {action &&
        (action.href ? (
          <Link href={action.href} className="btn btn-primary mt-5">
            {action.label}
          </Link>
        ) : (
          <button onClick={action.onClick} className="btn btn-primary mt-5">
            {action.label}
          </button>
        ))}
    </div>
  )
}

export function ErrorState({ title = "Something didn't work", body, onRetry, className }: { title?: string; body?: string; onRetry?: () => void; className?: string }) {
  return (
    <div className={cn('card flex flex-col items-center border-warning/25 px-6 py-10 text-center', className)} role="alert">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-warning-soft text-warning">
        <AlertTriangle size={20} />
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {body && <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted">{body}</p>}
      {onRetry && (
        <button onClick={onRetry} className="btn btn-ghost mt-5">
          <RefreshCw size={14} /> Try again
        </button>
      )}
    </div>
  )
}

export function InlineError({ message, className }: { message: string; className?: string }) {
  return (
    <div className={cn('flex items-start gap-2.5 rounded-xl border border-warning/25 bg-warning-soft px-4 py-3 text-sm leading-relaxed text-warning', className)} role="alert">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

/** Blur-locked panel with an upgrade overlay for free users. */
export function LockedOverlay({ children, title = 'Available on fyt Pro', body, cta = 'Upgrade to Pro' }: { children: React.ReactNode; title?: string; body?: string; cta?: string }) {
  return (
    <div className="relative overflow-hidden rounded-card">
      <div className="blur-locked" aria-hidden="true">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-base/40 p-6">
        <div className="card max-w-sm p-6 text-center shadow-glow" style={{ background: '#0D1F3C' }}>
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Lock size={18} />
          </div>
          <h4 className="text-base font-semibold text-ink">{title}</h4>
          {body && <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>}
          <Link href="/pricing" className="btn btn-accent mt-5 w-full">
            {cta}
          </Link>
        </div>
      </div>
    </div>
  )
}

export function ProgressBar({ value, className, tone = 'primary' }: { value: number; className?: string; tone?: 'primary' | 'accent' | 'warning' }) {
  const color = tone === 'accent' ? '#64FFDA' : tone === 'warning' ? '#FF6B6B' : '#2D6BE4'
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-line/50', className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: `linear-gradient(90deg, ${color}, ${tone === 'primary' ? '#64FFDA' : color})` }} />
    </div>
  )
}

export function StarRating({ value, onChange, size = 26 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <div className="flex items-center gap-1" role={onChange ? 'radiogroup' : undefined}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange?.(n)}
          disabled={!onChange}
          className={cn('transition-transform', onChange && 'hover:scale-110')}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          aria-pressed={value === n}
        >
          <svg width={size} height={size} viewBox="0 0 24 24" fill={n <= value ? '#FFC857' : 'none'} stroke={n <= value ? '#FFC857' : '#3D5280'} strokeWidth="1.6">
            <path d="M12 2.5L14.9 8.6L21.5 9.4L16.6 14L17.9 20.6L12 17.3L6.1 20.6L7.4 14L2.5 9.4L9.1 8.6L12 2.5Z" strokeLinejoin="round" />
          </svg>
        </button>
      ))}
    </div>
  )
}
