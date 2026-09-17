import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SearchFlow } from '@/components/search/SearchFlow'
import { CardSkeleton } from '@/components/ui/States'

export const metadata: Metadata = { title: 'Find matches' }

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl space-y-3">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      }
    >
      <SearchFlow />
    </Suspense>
  )
}
