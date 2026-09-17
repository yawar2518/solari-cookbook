import 'server-only'

import { getAccessToken } from '@/lib/supabase/server'

const BACKEND_URL = (process.env.BACKEND_URL || 'http://localhost:8000').replace(/\/$/, '')
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || ''

/**
 * Call the backend from a Server Component. Returns null on any failure so
 * pages can render a fallback and let the client re-fetch.
 */
export async function serverFetch<T>(path: string): Promise<T | null> {
  const token = await getAccessToken()
  if (!token) return null
  try {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      headers: {
        authorization: `Bearer ${token}`,
        ...(INTERNAL_SECRET ? { 'x-internal-secret': INTERNAL_SECRET } : {}),
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}
