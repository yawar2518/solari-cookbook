import type { Metadata } from 'next'
import { SavedJobs } from '@/components/dashboard/SavedJobs'

export const metadata: Metadata = { title: 'Saved jobs' }

export default function SavedPage() {
  return <SavedJobs />
}
