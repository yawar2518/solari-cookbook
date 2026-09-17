"""Search orchestration: cache → scrape → match, executed in the background.

A search takes 60-120s because of the stealth browser launch. Instead of
holding an HTTP request open, we create a search_runs row, return its id, and
update status/progress as we go. The frontend polls GET /search-jobs/{id}.
"""

from __future__ import annotations

import asyncio
import concurrent.futures
import logging
import traceback

from config import settings
from db import (
    get_cached_jobs,
    iso,
    job_id_for,
    now_utc,
    refund_credit,
    set_cached_jobs,
    update_search_run,
)
from matcher import match_jobs
from scraper import scrape_all

log = logging.getLogger("fyt.search")

MATCH_CHUNK = 15  # jobs per matcher call; keeps the JSON response well under max_tokens
MAX_JOBS_TO_MATCH = 45


def derive_keywords(profile: dict) -> list[str]:
    keywords = profile.get("search_keywords") or {}
    global_kw = [k for k in (keywords.get("global") or []) if isinstance(k, str) and k.strip()][:2]
    local_kw = [k for k in (keywords.get("local") or []) if isinstance(k, str) and k.strip()][:1]
    merged: list[str] = []
    for k in global_kw + local_kw:
        if k.strip().lower() not in {m.lower() for m in merged}:
            merged.append(k.strip())
    if not merged:
        # Fall back to inferred roles so a thin profile still searches something.
        for role in profile.get("inferred_roles") or []:
            name = role.get("role") if isinstance(role, dict) else None
            if name:
                merged.append(name)
            if len(merged) >= 3:
                break
    return merged


def derive_location(profile: dict, override: str | None = None) -> str:
    if override and override.strip():
        return override.strip()
    prefs = profile.get("preferences") or {}
    if prefs.get("location_type") == "remote":
        return "Remote"
    if prefs.get("city"):
        country = prefs.get("country") or ""
        return f"{prefs['city']}, {country}".strip(", ")
    if prefs.get("country"):
        return prefs["country"]
    return ""


def _run_scraper(keywords: list[str], location: str) -> list[dict]:
    """Run the async scraper on a dedicated event loop in a worker thread.

    On Windows Playwright needs a Proactor loop, and FastAPI's worker threads
    have no loop at all, so we always create a fresh one here.
    """

    def worker():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(scrape_all(keywords, location))
        finally:
            loop.close()

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(worker)
        return future.result(timeout=settings.scrape_timeout_seconds)


def _match_in_chunks(profile: dict, jobs: list[dict]) -> list[dict]:
    ranked: list[dict] = []
    for start in range(0, len(jobs), MATCH_CHUNK):
        chunk = jobs[start : start + MATCH_CHUNK]
        try:
            ranked.extend(match_jobs(profile, chunk))
        except Exception as e:  # noqa: BLE001
            log.warning("matcher failed for chunk %s: %s", start, e)
            # Keep the jobs visible even if scoring failed for this chunk.
            for job in chunk:
                ranked.append({**job, "match_score": 0, "match_label": "Unscored", "matching_skills": [], "missing_skills": [],
                               "why_it_fits": "We couldn't score this listing. Open it to judge for yourself.",
                               "what_you_learn": None, "concern": None})
    ranked.sort(key=lambda j: j.get("match_score") or 0, reverse=True)
    return ranked


def execute_search(run_id: str, user_id: str, profile: dict, keywords: list[str], location: str) -> None:
    """Blocking. Called by FastAPI's BackgroundTasks in a worker thread."""
    try:
        update_search_run(run_id, status="scraping", stage="Checking recent results", progress=8)
        cached = get_cached_jobs(keywords, location)
        cache_hit = cached is not None

        if cache_hit:
            jobs = cached
            update_search_run(run_id, stage="Found fresh listings from the last few hours", progress=45, cache_hit=True)
        else:
            update_search_run(run_id, stage="Launching a stealth browser", progress=12)
            jobs = _run_scraper(keywords, location)
            update_search_run(run_id, stage="Reading live listings", progress=40)
            if jobs:
                set_cached_jobs(keywords, location, jobs)

        for job in jobs:
            job["id"] = job.get("id") or job_id_for(job)

        if not jobs:
            update_search_run(
                run_id,
                status="done",
                stage="No listings found",
                progress=100,
                jobs=[],
                total=0,
                cache_hit=cache_hit,
                completed_at=iso(now_utc()),
            )
            # Nothing came back — not the user's fault, give the credit back.
            refund_credit(user_id, "search")
            return

        jobs = jobs[:MAX_JOBS_TO_MATCH]
        update_search_run(run_id, status="matching", stage=f"Ranking {len(jobs)} listings by fit", progress=60)
        ranked = _match_in_chunks(profile, jobs)

        update_search_run(
            run_id,
            status="done",
            stage="Done",
            progress=100,
            jobs=ranked,
            total=len(ranked),
            cache_hit=cache_hit,
            completed_at=iso(now_utc()),
        )
    except concurrent.futures.TimeoutError:
        refund_credit(user_id, "search")
        update_search_run(
            run_id,
            status="error",
            stage="Timed out",
            progress=100,
            error=f"The job sites took longer than {settings.scrape_timeout_seconds}s to respond. Your credit was refunded — please try again.",
            completed_at=iso(now_utc()),
        )
    except Exception as e:  # noqa: BLE001
        log.error("search %s failed: %s\n%s", run_id, e, traceback.format_exc())
        refund_credit(user_id, "search")
        update_search_run(
            run_id,
            status="error",
            stage="Failed",
            progress=100,
            error=(str(e) or type(e).__name__) + " — your credit was refunded.",
            completed_at=iso(now_utc()),
        )
