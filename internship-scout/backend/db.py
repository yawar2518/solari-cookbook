"""Supabase access for the backend.

The backend talks to Supabase with the service-role key, which bypasses RLS.
Every function here therefore takes an explicit user_id where relevant and is
responsible for scoping the query itself.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from typing import Any

from supabase import Client, create_client

from config import settings


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.isoformat()


def stable_hash(*parts: Any) -> str:
    """Deterministic sha256 over JSON-serialised parts (sorted keys)."""
    payload = json.dumps(parts, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def job_id_for(job: dict) -> str:
    """Stable id for a scraped job: derived from its URL (or title+company)."""
    basis = job.get("url") or f"{job.get('title','')}|{job.get('company','')}|{job.get('location','')}"
    return hashlib.sha1(basis.encode("utf-8")).hexdigest()[:16]


def _one(res) -> dict | None:
    data = getattr(res, "data", None)
    if isinstance(data, list):
        return data[0] if data else None
    return data


# ----------------------------------------------------------------------------
# profiles
# ----------------------------------------------------------------------------

def get_profile(user_id: str) -> dict | None:
    sb = get_supabase()
    return _one(sb.table("profiles").select("*").eq("id", user_id).limit(1).execute())


def ensure_profile(user: dict) -> dict:
    """Return the profile row, creating it if the signup trigger didn't run
    (e.g. users created before the schema was applied)."""
    existing = get_profile(user["id"])
    if existing:
        return existing
    sb = get_supabase()
    meta = user.get("user_metadata") or {}
    email = (user.get("email") or "").lower()
    row = {
        "id": user["id"],
        "email": email,
        "full_name": meta.get("full_name") or meta.get("name"),
        "avatar_url": meta.get("avatar_url"),
        "is_admin": email in settings.admin_emails,
        "search_credits": 10,
        "cover_letter_credits": 3,
    }
    sb.table("profiles").upsert(row, on_conflict="id").execute()
    return get_profile(user["id"]) or row


def touch_last_active(user_id: str) -> None:
    try:
        get_supabase().table("profiles").update({"last_active_at": iso(now_utc())}).eq("id", user_id).execute()
    except Exception:
        pass


def usage_today(user_id: str, action: str) -> int:
    sb = get_supabase()
    start = now_utc().replace(hour=0, minute=0, second=0, microsecond=0)
    res = (
        sb.table("credit_log")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .eq("action", action)
        .gte("created_at", iso(start))
        .execute()
    )
    return res.count or 0


def consume_credit(user_id: str, action: str, daily_limit: int) -> dict:
    sb = get_supabase()
    res = sb.rpc("consume_credit", {"p_user_id": user_id, "p_action": action, "p_daily_limit": daily_limit}).execute()
    data = res.data
    if isinstance(data, str):
        data = json.loads(data)
    return data or {"ok": False, "reason": "unknown"}


def refund_credit(user_id: str, action: str) -> None:
    try:
        get_supabase().rpc("refund_credit", {"p_user_id": user_id, "p_action": action}).execute()
    except Exception:
        pass


# ----------------------------------------------------------------------------
# user_profiles (context + parsed profile + CV)
# ----------------------------------------------------------------------------

def get_user_profile(user_id: str) -> dict | None:
    sb = get_supabase()
    return _one(sb.table("user_profiles").select("*").eq("user_id", user_id).limit(1).execute())


def upsert_user_profile(user_id: str, **fields) -> dict:
    sb = get_supabase()
    payload = {"user_id": user_id, "updated_at": iso(now_utc()), **fields}
    res = sb.table("user_profiles").upsert(payload, on_conflict="user_id").execute()
    return _one(res) or payload


# ----------------------------------------------------------------------------
# job cache
# ----------------------------------------------------------------------------

def cache_key(keywords: list[str], location: str) -> str:
    norm = sorted({k.strip().lower() for k in keywords if k.strip()})
    return stable_hash(norm, location.strip().lower())


def get_cached_jobs(keywords: list[str], location: str) -> list[dict] | None:
    sb = get_supabase()
    key = cache_key(keywords, location)
    row = _one(
        sb.table("job_cache")
        .select("*")
        .eq("keywords_hash", key)
        .eq("location", location.strip().lower())
        .gt("expires_at", iso(now_utc()))
        .limit(1)
        .execute()
    )
    if not row:
        return None
    try:
        sb.table("job_cache").update({"hit_count": (row.get("hit_count") or 0) + 1}).eq("id", row["id"]).execute()
    except Exception:
        pass
    return row.get("jobs") or []


def set_cached_jobs(keywords: list[str], location: str, jobs: list[dict]) -> None:
    sb = get_supabase()
    key = cache_key(keywords, location)
    expires = now_utc() + timedelta(hours=settings.job_cache_ttl_hours)
    sb.table("job_cache").upsert(
        {
            "keywords_hash": key,
            "keywords": keywords,
            "location": location.strip().lower(),
            "jobs": jobs,
            "scraped_at": iso(now_utc()),
            "expires_at": iso(expires),
            "hit_count": 0,
        },
        on_conflict="keywords_hash,location",
    ).execute()


# ----------------------------------------------------------------------------
# search runs
# ----------------------------------------------------------------------------

def create_search_run(user_id: str, profile: dict, keywords: list[str], location: str) -> dict:
    sb = get_supabase()
    res = (
        sb.table("search_runs")
        .insert(
            {
                "user_id": user_id,
                "profile": profile,
                "keywords": keywords,
                "location": location,
                "status": "queued",
                "stage": "Queued",
                "progress": 2,
            }
        )
        .execute()
    )
    return _one(res)


def update_search_run(run_id: str, **fields) -> None:
    get_supabase().table("search_runs").update(fields).eq("id", run_id).execute()


def get_search_run(run_id: str, user_id: str) -> dict | None:
    sb = get_supabase()
    return _one(sb.table("search_runs").select("*").eq("id", run_id).eq("user_id", user_id).limit(1).execute())


def list_search_runs(user_id: str, limit: int = 10, with_jobs: bool = False) -> list[dict]:
    sb = get_supabase()
    cols = "*" if with_jobs else "id,status,stage,progress,total,keywords,location,cache_hit,error,created_at,completed_at"
    res = sb.table("search_runs").select(cols).eq("user_id", user_id).order("created_at", desc=True).limit(limit).execute()
    return res.data or []


def find_job_for_user(user_id: str, job_id: str) -> dict | None:
    """Locate a job by id in the user's saved jobs, then recent search runs."""
    sb = get_supabase()
    saved = _one(sb.table("saved_jobs").select("job_data").eq("user_id", user_id).eq("job_id", job_id).limit(1).execute())
    if saved and saved.get("job_data"):
        return {**saved["job_data"], "saved": True}
    runs = list_search_runs(user_id, limit=8, with_jobs=True)
    for run in runs:
        for job in run.get("jobs") or []:
            if job.get("id") == job_id:
                return {**job, "run_id": run["id"]}
    return None


# ----------------------------------------------------------------------------
# saved jobs
# ----------------------------------------------------------------------------

def list_saved_jobs(user_id: str) -> list[dict]:
    res = get_supabase().table("saved_jobs").select("*").eq("user_id", user_id).order("saved_at", desc=True).execute()
    return res.data or []


def save_job(user_id: str, job: dict, notes: str | None = None) -> dict:
    sb = get_supabase()
    job_id = job.get("id") or job_id_for(job)
    row = {"user_id": user_id, "job_id": job_id, "job_data": {**job, "id": job_id}, "notes": notes}
    res = sb.table("saved_jobs").upsert(row, on_conflict="user_id,job_id").execute()
    return _one(res) or row


def unsave_job(user_id: str, job_id: str) -> None:
    get_supabase().table("saved_jobs").delete().eq("user_id", user_id).eq("job_id", job_id).execute()


def saved_job_ids(user_id: str) -> set[str]:
    res = get_supabase().table("saved_jobs").select("job_id").eq("user_id", user_id).execute()
    return {r["job_id"] for r in (res.data or [])}


# ----------------------------------------------------------------------------
# job details / company research caches
# ----------------------------------------------------------------------------

def get_job_details(job_id: str) -> dict | None:
    row = _one(get_supabase().table("job_details").select("*").eq("job_id", job_id).limit(1).execute())
    if not row:
        return None
    fetched = datetime.fromisoformat(row["fetched_at"].replace("Z", "+00:00"))
    if now_utc() - fetched > timedelta(days=settings.job_details_ttl_days):
        return None
    return row


def set_job_details(job_id: str, url: str, description: str | None) -> None:
    get_supabase().table("job_details").upsert(
        {"job_id": job_id, "url": url, "description": description, "fetched_at": iso(now_utc())},
        on_conflict="job_id",
    ).execute()


def get_company_research(key: str) -> dict | None:
    row = _one(get_supabase().table("company_research").select("*").eq("cache_key", key).limit(1).execute())
    if not row:
        return None
    created = datetime.fromisoformat(row["created_at"].replace("Z", "+00:00"))
    if now_utc() - created > timedelta(days=settings.company_research_ttl_days):
        return None
    return row.get("research")


def set_company_research(key: str, company: str, job_title: str, research: dict) -> None:
    get_supabase().table("company_research").upsert(
        {"cache_key": key, "company": company, "job_title": job_title, "research": research, "created_at": iso(now_utc())},
        on_conflict="cache_key",
    ).execute()


# ----------------------------------------------------------------------------
# cover letters, feedback, waitlist, llm usage
# ----------------------------------------------------------------------------

def insert_cover_letter(user_id: str, job: dict, letter: str, tailored: bool, cv_suggestions: list | None = None) -> dict:
    res = (
        get_supabase()
        .table("cover_letters")
        .insert(
            {
                "user_id": user_id,
                "job_id": job.get("id"),
                "job_title": job.get("title") or "Untitled role",
                "company": job.get("company") or "Unknown company",
                "letter_text": letter,
                "tailored": tailored,
                "cv_suggestions": cv_suggestions,
            }
        )
        .execute()
    )
    return _one(res) or {}


def list_cover_letters(user_id: str, limit: int = 20) -> list[dict]:
    res = (
        get_supabase()
        .table("cover_letters")
        .select("id,job_id,job_title,company,letter_text,tailored,cv_suggestions,created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return res.data or []


def insert_feedback(user_id: str, rating: int, message: str | None, page: str | None) -> None:
    get_supabase().table("feedback").insert({"user_id": user_id, "rating": rating, "message": message, "page": page}).execute()


def add_to_waitlist(email: str, plan: str, user_id: str | None) -> None:
    get_supabase().table("waitlist").upsert(
        {"email": email.lower(), "plan": plan, "user_id": user_id}, on_conflict="email"
    ).execute()


def record_llm_usage(user_id: str | None, action: str, model: str, input_tokens: int, output_tokens: int) -> None:
    cost = (input_tokens / 1_000_000) * settings.price_input_per_mtok + (output_tokens / 1_000_000) * settings.price_output_per_mtok
    try:
        get_supabase().table("llm_usage").insert(
            {
                "user_id": user_id,
                "action": action,
                "model": model,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "cost_usd": round(cost, 6),
            }
        ).execute()
    except Exception:
        # Accounting must never break a user-facing request.
        pass


# ----------------------------------------------------------------------------
# stats for dashboard
# ----------------------------------------------------------------------------

def user_stats(user_id: str) -> dict:
    sb = get_supabase()
    searches = sb.table("search_runs").select("id", count="exact").eq("user_id", user_id).execute().count or 0
    saved = sb.table("saved_jobs").select("id", count="exact").eq("user_id", user_id).execute().count or 0
    letters = sb.table("cover_letters").select("id", count="exact").eq("user_id", user_id).execute().count or 0
    return {"searches": searches, "saved_jobs": saved, "cover_letters": letters}
