import type { MatchLabel } from './types'

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

export function initials(name?: string | null, email?: string | null): string {
  const source = (name || email || '?').trim()
  const parts = source.split(/[\s@._-]+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

export function formatDate(value?: string | null, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, opts)
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function timeAgo(value?: string | null): string {
  if (!value) return ''
  const diff = Date.now() - new Date(value).getTime()
  if (Number.isNaN(diff)) return ''
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return formatDate(value)
}

export function scoreTone(score?: number): { color: string; bg: string; border: string; label: string } {
  const s = score ?? 0
  if (s >= 80) return { color: '#64FFDA', bg: 'rgba(100,255,218,0.08)', border: 'rgba(100,255,218,0.3)', label: 'Strong' }
  if (s >= 60) return { color: '#7EB8FF', bg: 'rgba(126,184,255,0.08)', border: 'rgba(126,184,255,0.3)', label: 'Good' }
  if (s >= 40) return { color: '#FFC857', bg: 'rgba(255,200,87,0.08)', border: 'rgba(255,200,87,0.3)', label: 'Partial' }
  return { color: '#7A95C9', bg: 'rgba(122,149,201,0.08)', border: 'rgba(122,149,201,0.25)', label: 'Stretch' }
}

export function labelPill(label?: MatchLabel): string {
  switch (label) {
    case 'Strong Match':
      return 'pill pill-accent'
    case 'Good Match':
      return 'pill pill-sky'
    case 'Partial Match':
      return 'pill pill-amber'
    default:
      return 'pill pill-muted'
  }
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function pluralize(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export const EXAMPLE_CONTEXTS = [
  {
    label: 'Early student',
    text: "I'm in my 2nd semester of Computer Science at FAST Lahore. I've done intro programming in C++ and Python, built a small to-do app, and I'm comfortable with basic Git. No work experience yet — looking for my first internship, ideally remote or in Lahore, part-time during the semester.",
  },
  {
    label: 'Mid-degree + freelance',
    text: "7th semester Software Engineering student. I know Python well, have built n8n automations, worked with the Claude API, and done freelancing on Upwork building LLM pipelines and automation tools. Not sure exactly what role I want but open to anything AI or backend related. Based in Lahore, open to remote globally or onsite in Pakistan.",
  },
  {
    label: 'Career switcher',
    text: 'I have 3 years in marketing and taught myself data analysis over the last year — SQL, Excel, Tableau, some Python with pandas. I built dashboards for my current team. Looking for a junior data analyst role, hybrid or remote, anywhere in Pakistan or the Gulf.',
  },
]
