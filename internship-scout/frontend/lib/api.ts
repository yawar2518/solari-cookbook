'use client'

/**
 * Typed client for the backend, always via the Next.js proxy at /api/backend.
 * Never call the FastAPI URL from the browser directly.
 */

import type {
  AdminCacheStats,
  AdminFeedback,
  AdminOverview,
  AdminUsage,
  AdminUser,
  CompanyResearch,
  CoverLetter,
  CvDocument,
  CvForm,
  CvReview,
  CvState,
  CvTailoring,
  Job,
  Me,
  ParsedProfile,
  SearchRun,
  SearchRunSummary,
} from './types'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
  get isAuth() {
    return this.status === 401
  }
  get isPaywall() {
    return this.status === 402
  }
  get isRateLimit() {
    return this.status === 429
  }
}

const BASE = '/api/backend'

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json()
    if (typeof data?.detail === 'string' && data.detail.trim()) return data.detail
    if (Array.isArray(data?.detail) && data.detail[0]?.msg) return data.detail[0].msg
  } catch {
    /* no JSON body */
  }
  return `${fallback} (${res.status})`
}

async function request<T>(path: string, init: RequestInit & { fallback?: string } = {}): Promise<T> {
  const { fallback = 'Request failed', ...rest } = init
  const headers = new Headers(rest.headers)
  if (rest.body && !(rest.body instanceof FormData) && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, { ...rest, headers, cache: 'no-store' })
  } catch {
    throw new ApiError("Can't reach fyt right now. Check your connection and try again.", 0)
  }
  if (!res.ok) throw new ApiError(await readError(res, fallback), res.status)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

const json = (body: unknown) => JSON.stringify(body)

export const api = {
  me: () => request<Me>('/me', { fallback: 'Could not load your account' }),

  parseContext: (context: string, force = false) =>
    request<{ profile: ParsedProfile; cached: boolean }>('/parse-context', {
      method: 'POST',
      body: json({ context, force }),
      fallback: "Couldn't read your profile",
    }),

  updateProfile: (parsed_profile: ParsedProfile) =>
    request<{ ok: true; profile: ParsedProfile }>('/profile', { method: 'PUT', body: json({ parsed_profile }), fallback: 'Could not save profile' }),

  startSearch: (profile: ParsedProfile | null, location?: string) =>
    request<{ run_id: string; keywords: string[]; location: string }>('/search-jobs', {
      method: 'POST',
      body: json({ profile, location: location || null }),
      fallback: "Couldn't start the search",
    }),

  searchStatus: (runId: string) => request<SearchRun>(`/search-jobs/${runId}`, { fallback: 'Could not check search status' }),
  recentSearches: () => request<{ runs: SearchRunSummary[] }>('/search-jobs', { fallback: 'Could not load searches' }),
  recentMatches: (limit = 6) =>
    request<{ run_id: string | null; searched_at: string | null; jobs: Job[]; total: number }>(`/matches/recent?limit=${limit}`, {
      fallback: 'Could not load matches',
    }),

  job: (id: string) => request<{ job: Job }>(`/jobs/${id}`, { fallback: 'Could not load this job' }),
  jobDescription: (id: string) =>
    request<{ description: string | null; cached: boolean }>(`/jobs/${id}/description`, { fallback: 'Could not fetch the description' }),
  jobResearch: (id: string) =>
    request<{ locked: boolean; research: CompanyResearch | null }>(`/jobs/${id}/research`, { fallback: 'Could not research this company' }),

  savedJobs: () => request<{ jobs: Job[] }>('/saved-jobs', { fallback: 'Could not load saved jobs' }),
  saveJob: (job: Job, notes?: string) =>
    request<{ ok: true; job_id: string }>('/saved-jobs', { method: 'POST', body: json({ job, notes }), fallback: 'Could not save job' }),
  updateNotes: (jobId: string, notes: string) =>
    request<{ ok: true }>(`/saved-jobs/${jobId}`, { method: 'PATCH', body: json({ notes }), fallback: 'Could not save notes' }),
  unsaveJob: (jobId: string) => request<{ ok: true }>(`/saved-jobs/${jobId}`, { method: 'DELETE', fallback: 'Could not remove job' }),

  /** Streams the letter. Resolves with the full text once the stream ends. */
  coverLetter: async (
    job: Job,
    profile: ParsedProfile | null,
    onChunk: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<{ text: string; tailored: boolean }> => {
    let res: Response
    try {
      res = await fetch(`${BASE}/cover-letter`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: json({ job, profile }),
        signal,
        cache: 'no-store',
      })
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err
      throw new ApiError("Can't reach fyt right now.", 0)
    }
    if (!res.ok) throw new ApiError(await readError(res, 'Could not write the cover letter'), res.status)
    const tailored = res.headers.get('x-tailored') === '1'
    const reader = res.body?.getReader()
    if (!reader) throw new ApiError('No response stream.', 500)
    const decoder = new TextDecoder()
    let text = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      text += chunk
      onChunk(text)
    }
    const errIdx = text.indexOf('\n\n[error]')
    if (errIdx !== -1) throw new ApiError(text.slice(errIdx + 9).trim(), 502)
    return { text, tailored }
  },

  cvTailoring: (job: Job, profile: ParsedProfile | null) =>
    request<{ suggestions: CvTailoring }>('/cover-letter/cv-suggestions', {
      method: 'POST',
      body: json({ job, profile }),
      fallback: 'Could not generate CV suggestions',
    }),

  coverLetters: () => request<{ letters: CoverLetter[] }>('/cover-letters', { fallback: 'Could not load cover letters' }),

  cv: () => request<CvState>('/cv', { fallback: 'Could not load your CV' }),
  uploadCv: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<{ cv: CvDocument; review: CvReview; context_summary: string | null; profile_populated: boolean; stored: boolean }>('/cv/upload', {
      method: 'POST',
      body: form,
      fallback: 'Could not process that CV',
    })
  },
  atsRewrite: (cv: CvDocument | null, target_role?: string) =>
    request<{ cv: CvDocument }>('/cv/ats-rewrite', { method: 'POST', body: json({ cv, target_role }), fallback: 'Could not rewrite the CV' }),
  generateCv: (form: CvForm) => request<{ cv: CvDocument }>('/cv/generate', { method: 'POST', body: json({ form }), fallback: 'Could not generate the CV' }),
  saveGeneratedCv: (cv: CvDocument) => request<{ ok: true }>('/cv/generated', { method: 'PUT', body: json({ cv }), fallback: 'Could not save the CV' }),
  cvPdf: async (cv: CvDocument): Promise<Blob> => {
    const res = await fetch(`${BASE}/cv/pdf`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: json({ cv }) })
    if (!res.ok) throw new ApiError(await readError(res, 'Could not build the PDF'), res.status)
    return res.blob()
  },

  feedback: (rating: number, message: string, page: string) =>
    request<{ ok: true }>('/feedback', { method: 'POST', body: json({ rating, message, page }), fallback: 'Could not send feedback' }),
  waitlist: (email: string, plan: 'pro_monthly' | 'pro_yearly') =>
    request<{ ok: true }>('/waitlist', { method: 'POST', body: json({ email, plan }), fallback: 'Could not join the waitlist' }),

  admin: {
    overview: () => request<AdminOverview>('/admin/overview', { fallback: 'Could not load overview' }),
    users: () => request<{ users: AdminUser[] }>('/admin/users', { fallback: 'Could not load users' }),
    feedback: () => request<{ feedback: AdminFeedback[] }>('/admin/feedback', { fallback: 'Could not load feedback' }),
    cacheStats: () => request<AdminCacheStats>('/admin/cache-stats', { fallback: 'Could not load cache stats' }),
    usage: (days = 14) => request<AdminUsage>(`/admin/credit-usage?days=${days}`, { fallback: 'Could not load usage' }),
    exportUrl: (table: 'users' | 'feedback' | 'waitlist' | 'usage') => `${BASE}/admin/export?table=${table}`,
  },
}

export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error && err.message) return err.message
  return fallback
}
