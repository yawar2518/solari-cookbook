'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import type { Me } from '@/lib/types'

interface UserContextValue {
  me: Me | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  /** Optimistically patch the cached `me` (e.g. after a credit is spent). */
  patch: (fn: (me: Me) => Me) => void
}

const UserContext = createContext<UserContextValue | null>(null)

export function UserProvider({ initialMe, children }: { initialMe: Me | null; children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(initialMe)
  const [loading, setLoading] = useState(!initialMe)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const next = await api.me()
      setMe(next)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your account')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (initialMe) return
    let active = true
    api
      .me()
      .then((next) => {
        if (!active) return
        setMe(next)
        setError(null)
      })
      .catch((err: unknown) => active && setError(err instanceof Error ? err.message : 'Could not load your account'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [initialMe])

  const patch = useCallback((fn: (me: Me) => Me) => setMe((m) => (m ? fn(m) : m)), [])

  const value = useMemo(() => ({ me, loading, error, refresh, patch }), [me, loading, error, refresh, patch])
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser must be used inside UserProvider')
  return ctx
}
