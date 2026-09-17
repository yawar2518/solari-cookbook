import { NextRequest } from 'next/server'
import { getAccessToken } from '@/lib/supabase/server'

/**
 * Server-side proxy to the FastAPI backend.
 *
 * The browser only ever talks to this route. It attaches the user's Supabase
 * access token (from the httpOnly cookie) as a Bearer token, plus an optional
 * shared secret, and streams the backend's response straight back — so
 * streamed cover letters and PDF downloads work unchanged. No API keys or
 * backend URLs are exposed to the client.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const BACKEND_URL = (process.env.BACKEND_URL || 'http://localhost:8000').replace(/\/$/, '')
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || ''

// Public endpoints that work without a session.
const PUBLIC_PATHS = new Set(['waitlist', 'health'])

const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'transfer-encoding', 'content-length', 'host'])

async function handler(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params
  const target = path.join('/')

  const token = await getAccessToken()
  if (!token && !PUBLIC_PATHS.has(target)) {
    return Response.json({ detail: 'Sign in to continue.' }, { status: 401 })
  }

  const headers = new Headers()
  const contentType = req.headers.get('content-type')
  if (contentType) headers.set('content-type', contentType)
  const accept = req.headers.get('accept')
  if (accept) headers.set('accept', accept)
  if (token) headers.set('authorization', `Bearer ${token}`)
  if (INTERNAL_SECRET) headers.set('x-internal-secret', INTERNAL_SECRET)

  const hasBody = !['GET', 'HEAD'].includes(req.method)
  const body = hasBody ? await req.arrayBuffer() : undefined

  let upstream: Response
  try {
    upstream = await fetch(`${BACKEND_URL}/${target}${req.nextUrl.search}`, {
      method: req.method,
      headers,
      body,
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(maxDuration * 1000),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    console.error(`[backend proxy] ${req.method} /${target} failed: ${message}`)
    return Response.json(
      { detail: 'The fyt API is unreachable right now. Please try again in a moment.' },
      { status: 502 },
    )
  }

  const outHeaders = new Headers()
  upstream.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) outHeaders.set(key, value)
  })
  outHeaders.set('cache-control', 'no-store')

  return new Response(upstream.body, { status: upstream.status, headers: outHeaders })
}

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE }
