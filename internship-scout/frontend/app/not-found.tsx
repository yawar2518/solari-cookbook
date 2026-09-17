import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-aurora px-5 text-center">
      <Logo />
      <h1 className="mt-8 text-4xl font-bold">Nothing here.</h1>
      <p className="mt-2 max-w-sm text-muted">That page doesn&apos;t exist, or it was from a search that has since expired.</p>
      <div className="mt-6 flex gap-3">
        <Link href="/dashboard" className="btn btn-primary">
          Go to dashboard
        </Link>
        <Link href="/" className="btn btn-ghost">
          Home
        </Link>
      </div>
    </div>
  )
}
