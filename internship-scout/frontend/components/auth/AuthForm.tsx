'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Eye, EyeOff, Mail } from 'lucide-react'
import { InlineError, Spinner } from '@/components/ui/States'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

type Mode = 'signin' | 'signup'

export function AuthForm({ initialMode, next }: { initialMode: Mode; next: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [mode, setMode] = useState<Mode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState<'email' | 'google' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL || ''
  const callback = `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    if (!email || !password) {
      setError('Email and password are required.')
      return
    }
    if (mode === 'signup' && password.length < 8) {
      setError('Use at least 8 characters for your password.')
      return
    }
    setBusy('email')
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName.trim() || undefined }, emailRedirectTo: callback },
        })
        if (error) throw error
        if (data.session) {
          router.replace(next)
          router.refresh()
          return
        }
        setNotice('Check your inbox — we sent a confirmation link. Once confirmed, sign in here.')
        setMode('signin')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.replace(next)
        router.refresh()
      }
    } catch (err) {
      setError(friendly(err))
    } finally {
      setBusy(null)
    }
  }

  const google = async () => {
    setError(null)
    setBusy('google')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callback, queryParams: { access_type: 'offline', prompt: 'select_account' } },
    })
    if (error) {
      setError(friendly(error))
      setBusy(null)
    }
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex rounded-xl border border-line-soft bg-base/50 p-1">
        {(['signin', 'signup'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m)
              setError(null)
            }}
            className={cn('flex-1 rounded-lg py-2 font-display text-sm font-semibold transition', mode === m ? 'bg-primary-soft text-ink' : 'text-muted hover:text-ink')}
          >
            {m === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        ))}
      </div>

      <button type="button" onClick={google} disabled={busy !== null} className="btn btn-ghost h-11 w-full text-sm">
        {busy === 'google' ? (
          <Spinner size={16} />
        ) : (
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C41 35.5 44 30.2 44 24c0-1.3-.1-2.4-.4-3.5z" />
          </svg>
        )}
        Continue with Google
      </button>

      <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-dim">
        <span className="h-px flex-1 bg-line-soft" /> or with email <span className="h-px flex-1 bg-line-soft" />
      </div>

      <form onSubmit={submit} className="space-y-3">
        {mode === 'signup' && (
          <div>
            <label className="mb-1 block text-xs text-muted" htmlFor="name">
              Full name
            </label>
            <input id="name" className="input-base h-11 text-sm" placeholder="Ayesha Khan" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs text-muted" htmlFor="email">
            Email
          </label>
          <div className="relative">
            <Mail size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
            <input
              id="email"
              type="email"
              className="input-base h-11 pl-9 text-sm"
              placeholder="you@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted" htmlFor="password">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPw ? 'text' : 'password'}
              className="input-base h-11 pr-10 text-sm"
              placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              required
              minLength={mode === 'signup' ? 8 : undefined}
            />
            <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dim hover:text-ink" aria-label={showPw ? 'Hide password' : 'Show password'}>
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {error && <InlineError message={error} />}
        {notice && <div className="rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-accent">{notice}</div>}

        <button className="btn btn-primary h-11 w-full text-sm" disabled={busy !== null}>
          {busy === 'email' ? <Spinner size={16} /> : mode === 'signin' ? 'Sign in' : 'Create free account'}
        </button>
      </form>

      {mode === 'signup' && (
        <p className="mt-4 text-center text-[11px] leading-relaxed text-dim">
          You get 10 search credits and 3 cover letters on signup. No card needed.
        </p>
      )}
    </div>
  )
}

function friendly(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/invalid login credentials/i.test(msg)) return 'Wrong email or password.'
  if (/email not confirmed/i.test(msg)) return 'Confirm your email first — check your inbox for the link.'
  if (/already registered|already exists/i.test(msg)) return 'That email already has an account. Try signing in.'
  if (/rate limit/i.test(msg)) return 'Too many attempts. Wait a minute and try again.'
  if (/provider is not enabled/i.test(msg)) return 'Google sign-in is not enabled on this Supabase project yet.'
  return msg || 'Something went wrong. Please try again.'
}
