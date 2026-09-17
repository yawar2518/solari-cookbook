'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { Spinner } from '@/components/ui/States'
import { api, errorMessage } from '@/lib/api'

export function WaitlistForm({ plan }: { plan: 'pro_monthly' | 'pro_yearly' }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError('Enter a valid email.')
      return
    }
    setBusy(true)
    try {
      await api.waitlist(email, plan)
      setDone(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-accent">
        <Check size={16} /> You&apos;re on the list. We&apos;ll email you the moment Pro opens.
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="text-xs text-muted">Get notified when Pro launches (and lock in launch pricing):</div>
      <div className="flex gap-2">
        <input
          type="email"
          className="input-base h-10 text-sm"
          placeholder="you@university.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Email for the Pro waitlist"
        />
        <button className="btn btn-soft h-10 shrink-0" disabled={busy}>
          {busy ? <Spinner size={14} /> : 'Notify me'}
        </button>
      </div>
      {error && <div className="text-xs text-warning">{error}</div>}
    </form>
  )
}
