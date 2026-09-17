import type { Metadata } from 'next'
import { JobDetail } from '@/components/jobs/JobDetail'

export const metadata: Metadata = { title: 'Job details' }

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <JobDetail jobId={id} />
}
