'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastKind = 'success' | 'error' | 'info'
interface Toast {
  id: number
  kind: ToastKind
  title: string
  body?: string
}

interface ToastApi {
  toast: (kind: ToastKind, title: string, body?: string) => void
  success: (title: string, body?: string) => void
  error: (title: string, body?: string) => void
  info: (title: string, body?: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const counter = useRef(0)

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const toast = useCallback(
    (kind: ToastKind, title: string, body?: string) => {
      const id = ++counter.current
      setToasts((t) => [...t.slice(-3), { id, kind, title, body }])
      setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4500)
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      toast,
      success: (t, b) => toast('success', t, b),
      error: (t, b) => toast('error', t, b),
      info: (t, b) => toast('info', t, b),
    }),
    [toast],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[200] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-card backdrop-blur fade-up',
              t.kind === 'success' && 'border-accent/30 bg-[#0b2a2a]/90',
              t.kind === 'error' && 'border-warning/30 bg-[#2a0f14]/90',
              t.kind === 'info' && 'border-primary/40 bg-surface/95',
            )}
            role="status"
          >
            {t.kind === 'success' && <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-accent" />}
            {t.kind === 'error' && <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />}
            {t.kind === 'info' && <Info size={18} className="mt-0.5 shrink-0 text-sky" />}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-ink">{t.title}</div>
              {t.body && <div className="mt-0.5 text-xs leading-relaxed text-muted">{t.body}</div>}
            </div>
            <button onClick={() => dismiss(t.id)} className="text-dim hover:text-ink" aria-label="Dismiss">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
