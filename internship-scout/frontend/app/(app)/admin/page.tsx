import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AdminDashboard } from '@/components/admin/AdminDashboard'
import { serverFetch } from '@/lib/server-api'
import type { Me } from '@/lib/types'

export const metadata: Metadata = { title: 'Admin' }

export default async function AdminPage() {
  // Server-side gate: non-admins never see this page render. The backend
  // enforces the same check on every /admin/* endpoint.
  const me = await serverFetch<Me>('/me')
  if (!me?.user.is_admin) redirect('/dashboard')
  return <AdminDashboard />
}
