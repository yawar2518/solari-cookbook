import type { Metadata } from 'next'
import { CvStudio } from '@/components/cv/CvStudio'

export const metadata: Metadata = { title: 'CV studio' }

export default function CvPage() {
  return <CvStudio />
}
