import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'

export function SiteNav({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line-soft bg-base/70 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-muted md:flex">
          <Link href="/#how" className="transition hover:text-ink">
            How it works
          </Link>
          <Link href="/pricing" className="transition hover:text-ink">
            Pricing
          </Link>
          <Link href="/#stories" className="transition hover:text-ink">
            Stories
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          {signedIn ? (
            <Link href="/dashboard" className="btn btn-primary h-9 px-4 text-xs sm:text-sm">
              Open dashboard
            </Link>
          ) : (
            <>
              <Link href="/auth" className="btn btn-ghost h-9 px-3 text-xs sm:px-4 sm:text-sm">
                Sign in
              </Link>
              <Link href="/auth?mode=signup" className="btn btn-primary h-9 px-3 text-xs sm:px-4 sm:text-sm">
                Start free
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line-soft">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-xs leading-relaxed text-dim">
            Context-aware job matching for students and early-career professionals. Live listings, honest scores.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted">
          <Link href="/pricing" className="hover:text-ink">
            Pricing
          </Link>
          <Link href="/auth" className="hover:text-ink">
            Sign in
          </Link>
          <a href="mailto:hello@fyt.app" className="hover:text-ink">
            Contact
          </a>
          <span className="text-dim">© {new Date().getFullYear()} fyt · Powered by Solari + Claude</span>
        </div>
      </div>
    </footer>
  )
}
