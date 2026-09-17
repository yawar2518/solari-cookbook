import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { UserProvider } from '@/components/providers/UserProvider'
import { serverFetch } from '@/lib/server-api'
import { createClient } from '@/lib/supabase/server'
import type { Me } from '@/lib/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  // Server-side hydrate so the header never flashes an empty credit pill.
  const initialMe = await serverFetch<Me>('/me')

  return (
    <UserProvider initialMe={initialMe}>
      <AppShell>{children}</AppShell>
    </UserProvider>
  )
}
