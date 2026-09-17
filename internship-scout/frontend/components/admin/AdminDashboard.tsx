'use client'

import { useEffect, useMemo, useState } from 'react'
import { Database, Download, MessageSquare, RefreshCw, Search, Users } from 'lucide-react'
import { CardSkeleton, ErrorState, Skeleton, StarRating } from '@/components/ui/States'
import { api, errorMessage } from '@/lib/api'
import type { AdminCacheStats, AdminFeedback, AdminOverview, AdminUsage, AdminUser } from '@/lib/types'
import { cn, formatDate, formatDateTime, timeAgo } from '@/lib/utils'

type Tab = 'users' | 'feedback' | 'cache'

export function AdminDashboard() {
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [feedback, setFeedback] = useState<AdminFeedback[] | null>(null)
  const [cache, setCache] = useState<AdminCacheStats | null>(null)
  const [usage, setUsage] = useState<AdminUsage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('users')
  const [query, setQuery] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const load = () =>
    Promise.all([api.admin.overview(), api.admin.users(), api.admin.feedback(), api.admin.cacheStats(), api.admin.usage(14)])
      .then(([o, u, f, c, g]) => {
        setOverview(o)
        setUsers(u.users)
        setFeedback(f.feedback)
        setCache(c)
        setUsage(g)
      })
      .catch((err: unknown) => setError(errorMessage(err)))
      .finally(() => setRefreshing(false))

  useEffect(() => {
    void load()
  }, [])

  const refreshAll = () => {
    setRefreshing(true)
    setError(null)
    void load()
  }

  const filteredUsers = useMemo(() => {
    if (!users) return []
    const q = query.trim().toLowerCase()
    return q ? users.filter((u) => u.email.toLowerCase().includes(q) || (u.full_name || '').toLowerCase().includes(q)) : users
  }, [users, query])

  if (error) return <ErrorState title="Admin data unavailable" body={error} onRetry={refreshAll} />

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Admin</div>
          <h1 className="mt-1 text-3xl font-bold">fyt operations</h1>
        </div>
        <button className="btn btn-ghost h-9 text-xs" onClick={refreshAll} disabled={refreshing} type="button">
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Tiles */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {overview ? (
          <>
            <Tile label="Total users" value={overview.total_users} sub={`${overview.pro_users} pro · +${overview.new_users_week} this week`} />
            <Tile label="Searches today" value={overview.searches_today} sub={`${overview.searches_week} this week`} />
            <Tile label="Cover letters" value={overview.cover_letters_today} sub={`${overview.cover_letters_total} all time`} />
            <Tile label="Credits used" value={overview.credits_used} sub={`${overview.active_today} active today`} />
            <Tile label="LLM cost (7d)" value={`$${overview.llm_cost_week_usd.toFixed(2)}`} sub={`${(overview.llm_tokens_week / 1000).toFixed(0)}k tokens`} />
            <Tile label="Avg rating" value={overview.avg_rating ?? '–'} sub={`${overview.feedback_count} responses`} />
            <Tile label="Cache hit rate" value={cache ? `${cache.cache_hit_rate}%` : '–'} sub={cache ? `${cache.active_entries} active entries` : ''} />
            <Tile label="Pro waitlist" value={overview.waitlist} sub="emails collected" />
          </>
        ) : (
          Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[86px]" />)
        )}
      </div>

      {/* Chart */}
      <div className="card mt-5 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="eyebrow">Daily API cost estimate</div>
            <div className="text-xs text-muted">Last 14 days · bars = cost, line = searches</div>
          </div>
          <div className="flex gap-2">
            <ExportButton table="usage" label="Usage CSV" />
          </div>
        </div>
        {usage ? <UsageChart usage={usage} /> : <Skeleton className="h-48 w-full" />}
        {usage && usage.cost_by_action.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {usage.cost_by_action.map((a) => (
              <span key={a.action} className="pill pill-muted">
                {a.action}: ${a.cost_usd.toFixed(3)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tables */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {(
          [
            ['users', 'Users', Users],
            ['feedback', 'Feedback', MessageSquare],
            ['cache', 'Job cache', Database],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn('flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-display text-xs font-semibold transition', tab === key ? 'border-primary/60 bg-primary-soft text-ink' : 'border-line-soft text-muted hover:text-ink')}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {tab === 'users' && (
            <div className="relative">
              <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-dim" />
              <input className="input-base h-8 w-48 pl-8 text-xs" placeholder="Filter by email or name" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          )}
          {tab === 'users' && <ExportButton table="users" label="Export CSV" />}
          {tab === 'feedback' && <ExportButton table="feedback" label="Export CSV" />}
          {tab === 'users' && <ExportButton table="waitlist" label="Waitlist CSV" />}
        </div>
      </div>

      <div className="card mt-3 overflow-hidden">
        {tab === 'users' &&
          (users === null ? (
            <div className="p-4">
              <CardSkeleton lines={4} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-xs">
                <thead className="bg-base/40 text-[10px] uppercase tracking-wider text-dim">
                  <tr>
                    <th className="px-4 py-2.5">Email</th>
                    <th className="px-4 py-2.5">Signed up</th>
                    <th className="px-4 py-2.5">Plan</th>
                    <th className="px-4 py-2.5 text-right">Searches</th>
                    <th className="px-4 py-2.5 text-right">Letters</th>
                    <th className="px-4 py-2.5 text-right">Credits (S / L)</th>
                    <th className="px-4 py-2.5">Last active</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="border-t border-line-soft hover:bg-surface-2/40">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-ink">{u.email}</div>
                        {u.full_name && <div className="text-[11px] text-muted">{u.full_name}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-muted">{formatDate(u.created_at, { month: 'short', day: 'numeric', year: '2-digit' })}</td>
                      <td className="px-4 py-2.5">
                        <span className={cn('pill', u.plan === 'pro' ? 'pill-accent' : 'pill-muted')}>{u.plan}</span>
                        {u.is_admin && <span className="pill pill-primary ml-1">admin</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-ink-2">{u.searches_used}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-ink-2">{u.cover_letters_used}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted">
                        {u.search_credits} / {u.cover_letter_credits}
                      </td>
                      <td className="px-4 py-2.5 text-muted">{u.last_active_at ? timeAgo(u.last_active_at) : '—'}</td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted">
                        No users match.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ))}

        {tab === 'feedback' &&
          (feedback === null ? (
            <div className="p-4">
              <CardSkeleton lines={4} />
            </div>
          ) : feedback.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted">No feedback yet.</div>
          ) : (
            <ul className="divide-y divide-line-soft">
              {feedback.map((f) => (
                <li key={f.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start">
                  <div className="w-36 shrink-0">
                    <StarRating value={f.rating} size={14} />
                    <div className="mt-1 text-[11px] text-dim">{formatDateTime(f.created_at)}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-ink-2">{f.message || <span className="text-dim">No message</span>}</div>
                    <div className="mt-1 text-[11px] text-muted">
                      {f.email || 'anonymous'} {f.page && <span className="text-dim">· {f.page}</span>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ))}

        {tab === 'cache' &&
          (cache === null ? (
            <div className="p-4">
              <CardSkeleton lines={4} />
            </div>
          ) : (
            <div className="p-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <Tile label="Entries" value={cache.cached_entries} sub={`${cache.active_entries} unexpired`} />
                <Tile label="Cache hits" value={cache.total_hits} />
                <Tile label="Search runs" value={cache.search_runs} />
                <Tile label="Hit rate" value={`${cache.cache_hit_rate}%`} sub="runs served from cache" />
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead className="text-[10px] uppercase tracking-wider text-dim">
                    <tr>
                      <th className="py-2 pr-4">Keywords</th>
                      <th className="py-2 pr-4">Location</th>
                      <th className="py-2 pr-4 text-right">Hits</th>
                      <th className="py-2 pr-4">Scraped</th>
                      <th className="py-2">Expires</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cache.top_entries.map((e) => (
                      <tr key={e.id} className="border-t border-line-soft">
                        <td className="py-2 pr-4 text-ink-2">{e.keywords.join(', ')}</td>
                        <td className="py-2 pr-4 text-muted">{e.location || 'anywhere'}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">{e.hit_count}</td>
                        <td className="py-2 pr-4 text-muted">{timeAgo(e.scraped_at)}</td>
                        <td className="py-2 text-muted">{formatDateTime(e.expires_at)}</td>
                      </tr>
                    ))}
                    {cache.top_entries.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-muted">
                          No active cache entries.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

function Tile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="text-[10px] uppercase tracking-wider text-dim">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted">{sub}</div>}
    </div>
  )
}

function ExportButton({ table, label }: { table: 'users' | 'feedback' | 'waitlist' | 'usage'; label: string }) {
  return (
    <a href={api.admin.exportUrl(table)} className="btn btn-ghost h-8 text-xs" download>
      <Download size={12} /> {label}
    </a>
  )
}

/** Inline SVG bar+line chart: no chart library, theme-native. */
function UsageChart({ usage }: { usage: AdminUsage }) {
  const days = usage.days
  const W = 720
  const H = 180
  const padL = 40
  const padR = 34
  const padB = 24
  const padT = 10
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const maxCost = Math.max(0.01, ...days.map((d) => d.cost_usd))
  const maxSearch = Math.max(1, ...days.map((d) => d.searches))
  const bw = innerW / days.length
  const x = (i: number) => padL + i * bw
  const yCost = (v: number) => padT + innerH - (v / maxCost) * innerH
  const ySearch = (v: number) => padT + innerH - (v / maxSearch) * innerH
  const line = days.map((d, i) => `${x(i) + bw / 2},${ySearch(d.searches)}`).join(' ')

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-48 w-full min-w-[560px]" role="img" aria-label="Daily cost and searches">
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={padT + innerH * (1 - t)} y2={padT + innerH * (1 - t)} stroke="rgba(26,58,107,0.5)" strokeDasharray="3 4" />
            <text x={padL - 6} y={padT + innerH * (1 - t) + 4} textAnchor="end" fontSize="10" fill="#3D5280">
              ${(maxCost * t).toFixed(2)}
            </text>
            <text x={W - padR + 6} y={padT + innerH * (1 - t) + 4} textAnchor="start" fontSize="10" fill="#3D5280">
              {Math.round(maxSearch * t)}
            </text>
          </g>
        ))}
        {days.map((d, i) => (
          <g key={d.date}>
            <rect x={x(i) + bw * 0.2} y={yCost(d.cost_usd)} width={bw * 0.6} height={Math.max(0, padT + innerH - yCost(d.cost_usd))} rx="3" fill="rgba(45,107,228,0.55)">
              <title>
                {d.date}: ${d.cost_usd.toFixed(3)} · {d.calls} calls · {d.searches} searches · {d.cover_letters} letters
              </title>
            </rect>
            {(i % 2 === 0 || days.length <= 7) && (
              <text x={x(i) + bw / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="#7A95C9">
                {d.date.slice(5)}
              </text>
            )}
          </g>
        ))}
        <polyline points={line} fill="none" stroke="#64FFDA" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {days.map((d, i) => (
          <circle key={d.date} cx={x(i) + bw / 2} cy={ySearch(d.searches)} r="2.5" fill="#64FFDA" />
        ))}
      </svg>
    </div>
  )
}
