'use client'

import { ErrorState } from '@/components/ui/States'

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl py-10">
      <ErrorState title="This page hit an error" body={error.message || 'Something unexpected happened.'} onRetry={reset} />
    </div>
  )
}
