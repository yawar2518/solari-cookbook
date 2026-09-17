'use client'

import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { MessageSquarePlus } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { StarRating, Spinner } from '@/components/ui/States'
import { useToast } from '@/components/providers/ToastProvider'
import { api, errorMessage } from '@/lib/api'

export function FeedbackWidget() {
  const pathname = usePathname()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(0)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!rating) {
      toast.info('Pick a star rating first')
      return
    }
    setBusy(true)
    try {
      await api.feedback(rating, message.trim(), pathname)
      toast.success('Thanks for the feedback', 'It goes straight to the team.')
      setOpen(false)
      setRating(0)
      setMessage('')
    } catch (err) {
      toast.error('Could not send feedback', errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-primary/40 bg-surface text-sky shadow-glow transition hover:scale-105 hover:text-ink sm:h-12 sm:w-auto sm:gap-2 sm:px-4"
        aria-label="Send feedback"
        title="Send feedback"
      >
        <MessageSquarePlus size={18} />
        <span className="hidden text-sm font-semibold sm:inline">Feedback</span>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Feedback"
        title="How is fyt working for you?"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={submit} disabled={busy}>
              {busy ? <Spinner size={16} /> : null} Send
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <div className="mb-2 text-sm text-muted">Rate your experience</div>
            <StarRating value={rating} onChange={setRating} size={30} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-muted" htmlFor="fb-message">
              Anything we should know? <span className="text-dim">(optional)</span>
            </label>
            <textarea
              id="fb-message"
              className="input-base min-h-[110px] resize-y text-sm"
              placeholder="A bug, a wish, a match that was way off..."
              value={message}
              maxLength={2000}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </>
  )
}
