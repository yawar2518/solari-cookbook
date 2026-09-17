# fyt — Find your fit

**Find opportunities that actually fit you.**

fyt is an AI-powered job and internship matching platform for students and early-career professionals. Instead of skill filters, you describe yourself in plain English. Claude infers your real experience level, hidden skills and fitting roles; a Solari stealth browser reads live listings; every match gets a 0–100 fit score with an honest reason why.

A 2nd-semester student with no experience gets entry-level internships. A 7th-semester student with freelance work gets mid-level roles. The model respects the whole spectrum.

---

## Stack

| Layer | Tech |
| --- | --- |
| Frontend | Next.js 16 (App Router), React 19, TypeScript strict, Tailwind CSS v4 |
| Backend | FastAPI (Python 3.12) |
| Database / auth / storage | Supabase (Postgres + Auth + Storage) |
| Job scraping | Solari browser SDK (`solari_browser`) — stealth, residential proxy, captcha solving |
| AI | Anthropic Claude (`claude-sonnet-4-6` by default, configurable) |
| Deployment | Vercel (frontend) + Railway (backend) |

> **Note on Next.js version.** The spec named Next.js 14. The scaffold already shipped with Next.js 16 and React 19 installed, and the App Router API is the same, so we kept 16 rather than downgrading React and Tailwind. The one convention that differs: `proxy.ts` replaces `middleware.ts`.

---

## Repository layout

```
internship-scout/
├── backend/
│   ├── main.py                 FastAPI app (routers, CORS, error handlers)
│   ├── config.py               settings from env
│   ├── auth.py                 Supabase JWT verification → CurrentUser
│   ├── credits.py              daily limits + credit balance enforcement
│   ├── db.py                   Supabase data access (service role)
│   ├── llm.py                  shared Claude helpers (JSON, streaming, web search)
│   ├── search_service.py       background search: cache → scrape → match
│   ├── job_details_service.py  lazy full-description fetch (Solari, cached 7d)
│   ├── company_research.py     Claude + web search research (Pro)
│   ├── cv_service.py           PDF/DOCX extraction, CV prompts, PDF rendering
│   ├── routers/                profile, search, jobs, cover_letters, cv, feedback, admin
│   ├── context_parser.py       (pre-existing) plain English → structured profile
│   ├── scraper.py              (pre-existing) Solari scraper: LinkedIn, Internshala, Rozee
│   ├── matcher.py              (pre-existing) Claude ranking with scores + skill gaps
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── app/                    routes (landing, auth, pricing, (app)/dashboard|search|cv|jobs|saved|admin)
│   ├── app/api/backend/[...path]/route.ts   server-side proxy to FastAPI
│   ├── proxy.ts                session refresh + auth redirects
│   ├── components/             ui, layout, landing, auth, search, jobs, cover, cv, dashboard, admin
│   ├── lib/                    api client, types, supabase clients, utils
│   └── .env.example
├── supabase/
│   └── schema.sql              full schema, RLS, triggers, RPCs, storage bucket
└── README.md
```

---

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste the whole of `supabase/schema.sql`, run it. It is idempotent.
3. **Authentication → Providers**: enable **Email** (keep "Confirm email" on for production) and **Google** (paste your Google OAuth client id/secret; set the authorised redirect URI to `https://<project-ref>.supabase.co/auth/v1/callback`).
4. **Authentication → URL Configuration**: set Site URL to your frontend URL and add `http://localhost:3000/auth/callback` and `https://<your-domain>/auth/callback` to Redirect URLs.
5. Copy from **Project Settings → API**: Project URL, `anon` key, `service_role` key.

The admin email is seeded in `schema.sql` (`admin_emails` table). Add more rows there or via `ADMIN_EMAILS` in the backend env.

### 2. Backend

```bash
cd internship-scout/backend
python -m venv .venv && .venv\Scripts\activate    # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium                        # only needed if you run Solari locally
copy .env.example .env                             # then fill in the values
python main.py                                     # http://localhost:8000  (docs at /docs)
```

Required env: `ANTHROPIC_API_KEY`, `SOLARI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Everything else has sensible defaults; see `.env.example`.

Health check: `GET /health` reports missing config.

### 3. Frontend

```bash
cd internship-scout/frontend
npm install
copy .env.example .env.local                       # then fill in the values
npm run dev                                        # http://localhost:3000
```

Required env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `BACKEND_URL`.

### 4. First run

1. Sign up at `/auth`. The Postgres trigger creates your `profiles` row with 10 search credits and 3 cover letter credits.
2. If your email is in `admin_emails`, `/admin` appears in the sidebar.
3. Go to **Find matches**, describe yourself, confirm the profile, search. The first search launches a stealth browser and takes 60–120 s; repeats with the same keywords are instant for 6 hours.

To make a user Pro while payments are "coming soon":

```sql
update public.profiles set plan = 'pro' where email = 'someone@example.com';
```

---

## How it fits together

```
Browser ──► Next.js (Vercel)
             │  /api/backend/*  (attaches Supabase JWT + optional shared secret)
             ▼
           FastAPI (Railway) ──► Supabase (service role)
             │                     profiles · user_profiles · job_cache · search_runs
             │                     saved_jobs · cover_letters · feedback · credit_log · llm_usage
             ├──► Anthropic Claude (parse, match, letters, CV, research)
             └──► Solari browser  (LinkedIn / Internshala / Rozee)
```

**Key decisions**

- **All Claude calls are server-side in FastAPI.** The browser only ever calls the Next.js proxy route, which forwards the user's session token. No API keys or backend URL reach the client.
- **Auth verification** happens in FastAPI by asking Supabase Auth to validate the token (works with both legacy HS256 and the newer asymmetric signing keys), cached 90 s per token.
- **Searches run in the background.** `POST /search-jobs` returns a `run_id` immediately; the frontend polls `GET /search-jobs/{id}` every 2.5 s and shows stage + progress. You can navigate away; the dashboard shows running searches.
- **Job cache** is keyed by a hash of sorted, lower-cased keywords + location, TTL 6 h. Cache hits skip Solari entirely.
- **Context parsing cache**: the raw text is hashed; re-submitting identical text returns the stored profile without a Claude call.
- **Credits and daily limits** are enforced atomically by the `consume_credit()` Postgres function (row lock on `profiles`). Free: 3 searches/day + 3 cover letters/day, and a lifetime balance of 10 / 3 granted at signup. Pro is unlimited and never charged. Failed or empty searches refund the credit.
- **Matching in chunks**: the pre-existing matcher is called on 15 jobs at a time (max 45) so its JSON output stays well under `max_tokens`; chunks are merged and re-sorted by score.
- **Cover letters stream** as plain text through the proxy. Free letters are written from the profile + role title only; Pro letters read the full listing (fetched lazily via Solari and cached 7 d) and come with CV tailoring suggestions.
- **Company research** (Pro) uses Claude's server-side web search tool with a fallback chain (`web_search_20260209` → `web_search_20250305` → no search). Cached 7 d per company + role. Free users see a blurred placeholder with an upgrade overlay; no LLM cost is incurred for them.
- **Admin cost chart** is fed by `llm_usage`, which records token counts for every call made through `llm.py`. The pre-existing parser/matcher use their own clients, so their usage is logged as an estimate.
- **CV PDF** is rendered with ReportLab: single column, real text, Helvetica — ATS-safe by construction.

---

## API (FastAPI)

All routes except `/`, `/health`, `/waitlist` require `Authorization: Bearer <supabase access token>`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/me` | user, usage, profile summary, stats, completeness |
| POST | `/parse-context` | plain English → structured profile (cached by hash) |
| PUT | `/profile` | save an edited profile |
| POST | `/search-jobs` | start a background search → `202 {run_id}` |
| GET | `/search-jobs/{id}` | status/progress; includes `jobs` when done |
| GET | `/search-jobs` | recent runs |
| GET | `/matches/recent` | latest completed run's top jobs |
| GET | `/jobs/{id}` | job by id (from saved or recent runs) |
| GET | `/jobs/{id}/description` | fetch + cache the full description |
| GET | `/jobs/{id}/research` | company research (Pro) or `{locked: true}` |
| GET/POST/PATCH/DELETE | `/saved-jobs` | shortlist + notes |
| POST | `/cover-letter` | streamed letter (`X-Tailored` header) |
| POST | `/cover-letter/cv-suggestions` | CV tailoring for a job (Pro) |
| GET | `/cover-letters` | history |
| GET | `/cv` | current CV state |
| POST | `/cv/upload` | PDF/DOCX → structured CV + review |
| POST | `/cv/ats-rewrite` | ATS rewrite (Pro) |
| POST | `/cv/generate` | wizard form → CV |
| PUT | `/cv/generated` | save an edited generated CV |
| POST | `/cv/pdf` | render a CV JSON to PDF |
| POST | `/feedback` | 1–5 rating + message |
| POST | `/waitlist` | Pro waitlist email |
| GET | `/admin/overview` `/users` `/feedback` `/cache-stats` `/credit-usage` `/export?table=` | admin only |

Error responses are `{ "detail": "human-readable message" }` with proper status codes (401 auth, 402 out of credits, 403 forbidden, 404, 413, 415, 422, 429 daily limit, 502 upstream, 504 timeout).

---

## Deployment

### Backend → Railway

1. New project → Deploy from GitHub → root directory `internship-scout/backend`.
2. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
3. Set every variable from `backend/.env.example`. Set `CORS_ORIGINS` to your Vercel URL and pick a long random `INTERNAL_API_SECRET`.
4. Railway's default request timeout is fine because searches run in the background; only the proxy's `maxDuration` matters for streaming.

### Frontend → Vercel

1. Import the repo, root directory `internship-scout/frontend`.
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `BACKEND_URL` (Railway URL), `INTERNAL_API_SECRET` (same value as backend), `NEXT_PUBLIC_SITE_URL`.
3. Add the Vercel domain to Supabase redirect URLs (step 1.4).

---

## Operations

- **Purge expired cache**: `select public.purge_expired_job_cache();` (wire to pg_cron if desired).
- **Exports**: Admin → CSV buttons (users, feedback, waitlist, LLM usage).
- **Cost tuning**: `PRICE_INPUT_PER_MTOK` / `PRICE_OUTPUT_PER_MTOK` in the backend env drive the admin cost estimate.
- **Model**: `CLAUDE_MODEL` in the backend env switches every new call (the pre-existing parser/matcher pin `claude-sonnet-4-6` in code).

---

## Local verification performed

- `python -c "import main"` and FastAPI TestClient: `/`, `/health`, and unauthenticated `/me` → 401.
- ReportLab PDF render → pypdf text extraction round trip.
- `npx tsc --noEmit` (strict) clean; `next build` clean.

End-to-end runs against live Supabase, Solari and Anthropic require the keys in the `.env` files.
