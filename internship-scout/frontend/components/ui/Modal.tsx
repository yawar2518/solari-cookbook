'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: React.ReactNode
  eyebrow?: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizes = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }

export function Modal({ open, onClose, title, eyebrow, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[150] flex items-end justify-center bg-base/80 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div className={cn('card flex max-h-[92vh] w-full flex-col rounded-b-none sm:rounded-b-card fade-up', sizes[size])} style={{ background: '#0D1F3C' }}>
        <div className="flex items-start justify-between gap-4 border-b border-line-soft px-5 py-4 sm:px-6">
          <div className="min-w-0">
            {eyebrow && <div className="eyebrow text-accent">{eyebrow}</div>}
            {title && <h3 className="mt-0.5 truncate text-base font-semibold text-ink">{title}</h3>}
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-dim transition hover:bg-primary-soft hover:text-ink" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">{children}</div>
        {footer && <div className="border-t border-line-soft px-5 py-3 sm:px-6">{footer}</div>}
      </div>
    </div>
  )
}
