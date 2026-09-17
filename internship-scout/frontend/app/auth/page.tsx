import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthForm } from '@/components/auth/AuthForm'
import { Logo } from '@/components/ui/Logo'

export const metadata: Metadata = { title: 'Sign in' }

const SAFE_NEXT = /^\/(?!\/)[A-Za-z0-9/_\-?=&]*$/

export default async function AuthPage({ searchParams }: { searchParams: Promise<{ mode?: string; next?: string; error?: string }> }) {
  const params = await searchParams
  const mode = params.mode === 'signup' ? 'signup' : 'signin'
  const next = params.next && SAFE_NEXT.test(params.next) ? params.next : '/dashboard'

  return (
    <div className="grid min-h-screen bg-aurora lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden border-r border-line-soft bg-grid p-10 lg:flex lg:flex-col">
        <Logo />
        <div className="my-auto max-w-md">
          <div className="eyebrow text-accent">Why people use fyt</div>
          <h2 className="mt-3 text-3xl font-bold leading-tight">Job boards match keywords. fyt matches you.</h2>
          <ul className="mt-8 space-y-5">
            {[
              ['Say it in plain English', 'No dropdowns. Your semester, projects and doubts are all signal.'],
              ['Honest scores', 'Every match says why it fits, what you’d learn, and the biggest gap.'],
              ['Live listings', 'A stealth browser reads LinkedIn and local boards in real time.'],
            ].map(([t, b]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                <div>
                  <div className="text-sm font-semibold text-ink">{t}</div>
                  <div className="mt-0.5 text-sm text-muted">{b}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="text-xs text-dim">Powered by Solari + Claude</div>
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-primary/15 blur-3xl" aria-hidden="true" />
      </div>

      {/* Form */}
      <div className="flex items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="text-2xl font-bold">{mode === 'signup' ? 'Create your free account' : 'Welcome back'}</h1>
          <p className="mt-1.5 text-sm text-muted">{mode === 'signup' ? 'Two minutes to your first ranked matches.' : 'Sign in to continue to your matches.'}</p>
          {params.error && <div className="mt-4 rounded-xl border border-warning/25 bg-warning-soft px-4 py-3 text-sm text-warning">{decodeURIComponent(params.error)}</div>}
          <div className="card mt-6 p-6">
            <AuthForm initialMode={mode} next={next} />
          </div>
          <p className="mt-6 text-center text-xs text-dim">
            <Link href="/" className="hover:text-ink">
              ← Back to home
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
