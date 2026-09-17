"""/admin/* — protected by require_admin (ADMIN_EMAILS env or profiles.is_admin)."""

from __future__ import annotations

import csv
import io
from collections import defaultdict
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from auth import CurrentUser, require_admin
from db import get_supabase, iso, now_utc

router = APIRouter(prefix="/admin", tags=["admin"])


def _count(table: str, **filters) -> int:
    q = get_supabase().table(table).select("id", count="exact")
    for key, value in filters.items():
        if key.endswith("__gte"):
            q = q.gte(key[:-5], value)
        elif key.endswith("__in"):
            q = q.in_(key[:-4], value)
        else:
            q = q.eq(key, value)
    return q.execute().count or 0


@router.get("/overview")
def overview(_: CurrentUser = Depends(require_admin)):
    sb = get_supabase()
    day_start = iso(now_utc().replace(hour=0, minute=0, second=0, microsecond=0))
    week_start = iso(now_utc() - timedelta(days=7))

    total_users = _count("profiles")
    pro_users = _count("profiles", plan="pro")
    new_users_week = _count("profiles", created_at__gte=week_start)
    searches_today = _count("search_runs", created_at__gte=day_start)
    searches_week = _count("search_runs", created_at__gte=week_start)
    letters_today = _count("cover_letters", created_at__gte=day_start)
    letters_total = _count("cover_letters")
    credits_used = _count("credit_log", action__in=["search", "cover_letter"])
    active_today = _count("profiles", last_active_at__gte=day_start)

    usage = sb.table("llm_usage").select("cost_usd,input_tokens,output_tokens").gte("created_at", week_start).execute().data or []
    cost_week = round(sum(float(r.get("cost_usd") or 0) for r in usage), 4)
    tokens_week = sum(int(r.get("input_tokens") or 0) + int(r.get("output_tokens") or 0) for r in usage)

    fb = sb.table("feedback").select("rating").execute().data or []
    avg_rating = round(sum(r["rating"] for r in fb) / len(fb), 2) if fb else None

    return {
        "total_users": total_users,
        "pro_users": pro_users,
        "new_users_week": new_users_week,
        "active_today": active_today,
        "searches_today": searches_today,
        "searches_week": searches_week,
        "cover_letters_today": letters_today,
        "cover_letters_total": letters_total,
        "credits_used": credits_used,
        "llm_cost_week_usd": cost_week,
        "llm_tokens_week": tokens_week,
        "feedback_count": len(fb),
        "avg_rating": avg_rating,
        "waitlist": _count("waitlist"),
    }


@router.get("/users")
def users(limit: int = 200, _: CurrentUser = Depends(require_admin)):
    sb = get_supabase()
    rows = (
        sb.table("profiles")
        .select("id,email,full_name,plan,is_admin,search_credits,cover_letter_credits,last_active_at,created_at")
        .order("created_at", desc=True)
        .limit(min(limit, 1000))
        .execute()
        .data
        or []
    )
    ids = [r["id"] for r in rows]
    counts: dict[str, int] = defaultdict(int)
    letters: dict[str, int] = defaultdict(int)
    if ids:
        for r in sb.table("search_runs").select("user_id").in_("user_id", ids).execute().data or []:
            counts[r["user_id"]] += 1
        for r in sb.table("cover_letters").select("user_id").in_("user_id", ids).execute().data or []:
            letters[r["user_id"]] += 1
    for r in rows:
        r["searches_used"] = counts.get(r["id"], 0)
        r["cover_letters_used"] = letters.get(r["id"], 0)
    return {"users": rows}


@router.get("/feedback")
def feedback(limit: int = 200, _: CurrentUser = Depends(require_admin)):
    sb = get_supabase()
    rows = sb.table("feedback").select("*").order("created_at", desc=True).limit(min(limit, 1000)).execute().data or []
    ids = list({r["user_id"] for r in rows if r.get("user_id")})
    emails = {}
    if ids:
        for p in sb.table("profiles").select("id,email").in_("id", ids).execute().data or []:
            emails[p["id"]] = p["email"]
    for r in rows:
        r["email"] = emails.get(r.get("user_id"))
    return {"feedback": rows}


@router.get("/cache-stats")
def cache_stats(_: CurrentUser = Depends(require_admin)):
    sb = get_supabase()
    now = iso(now_utc())
    rows = sb.table("job_cache").select("id,keywords,location,hit_count,scraped_at,expires_at").order("scraped_at", desc=True).limit(500).execute().data or []
    active = [r for r in rows if r["expires_at"] > now]
    total_hits = sum(r.get("hit_count") or 0 for r in rows)
    runs = sb.table("search_runs").select("cache_hit").execute().data or []
    run_hits = sum(1 for r in runs if r.get("cache_hit"))
    hit_rate = round(run_hits / len(runs) * 100, 1) if runs else 0.0
    active.sort(key=lambda r: r.get("hit_count") or 0, reverse=True)
    for r in active:
        r["jobs_count"] = None
    return {
        "cached_entries": len(rows),
        "active_entries": len(active),
        "total_hits": total_hits,
        "search_runs": len(runs),
        "cache_hit_rate": hit_rate,
        "top_entries": active[:10],
    }


@router.get("/credit-usage")
def credit_usage(days: int = 14, _: CurrentUser = Depends(require_admin)):
    sb = get_supabase()
    days = max(1, min(days, 90))
    start = now_utc().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days - 1)
    usage = sb.table("llm_usage").select("created_at,cost_usd,input_tokens,output_tokens,action").gte("created_at", iso(start)).execute().data or []
    credits = sb.table("credit_log").select("created_at,action").gte("created_at", iso(start)).in_("action", ["search", "cover_letter"]).execute().data or []

    by_day: dict[str, dict] = {}
    for i in range(days):
        d = (start + timedelta(days=i)).date().isoformat()
        by_day[d] = {"date": d, "cost_usd": 0.0, "tokens": 0, "searches": 0, "cover_letters": 0, "calls": 0}
    for r in usage:
        d = r["created_at"][:10]
        if d in by_day:
            by_day[d]["cost_usd"] += float(r.get("cost_usd") or 0)
            by_day[d]["tokens"] += int(r.get("input_tokens") or 0) + int(r.get("output_tokens") or 0)
            by_day[d]["calls"] += 1
    for r in credits:
        d = r["created_at"][:10]
        if d in by_day:
            if r["action"] == "search":
                by_day[d]["searches"] += 1
            else:
                by_day[d]["cover_letters"] += 1
    series = list(by_day.values())
    for s in series:
        s["cost_usd"] = round(s["cost_usd"], 4)
    by_action: dict[str, float] = defaultdict(float)
    for r in usage:
        by_action[r.get("action") or "other"] += float(r.get("cost_usd") or 0)
    return {"days": series, "cost_by_action": [{"action": k, "cost_usd": round(v, 4)} for k, v in sorted(by_action.items(), key=lambda kv: -kv[1])]}


@router.get("/export")
def export(table: str, _: CurrentUser = Depends(require_admin)):
    sb = get_supabase()
    if table == "users":
        rows = users(limit=1000, _=_)["users"]
        fields = ["email", "full_name", "plan", "is_admin", "search_credits", "cover_letter_credits", "searches_used", "cover_letters_used", "last_active_at", "created_at"]
    elif table == "feedback":
        rows = feedback(limit=1000, _=_)["feedback"]
        fields = ["email", "rating", "message", "page", "created_at"]
    elif table == "waitlist":
        rows = sb.table("waitlist").select("email,plan,created_at").order("created_at", desc=True).execute().data or []
        fields = ["email", "plan", "created_at"]
    elif table == "usage":
        rows = sb.table("llm_usage").select("created_at,action,model,input_tokens,output_tokens,cost_usd").order("created_at", desc=True).limit(5000).execute().data or []
        fields = ["created_at", "action", "model", "input_tokens", "output_tokens", "cost_usd"]
    else:
        raise HTTPException(status_code=400, detail="Unknown export. Use users, feedback, waitlist, or usage.")

    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    for r in rows:
        writer.writerow({k: r.get(k) for k in fields})
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="fyt-{table}-{now_utc().date().isoformat()}.csv"'},
    )
