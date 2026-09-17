"""/search-jobs — start a background search and poll its progress."""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel

from auth import CurrentUser, get_current_user
from credits import ACTION_SEARCH, charge, refund
from db import create_search_run, get_search_run, get_user_profile, list_search_runs, saved_job_ids
from search_service import derive_keywords, derive_location, execute_search

router = APIRouter(tags=["search"])


class SearchRequest(BaseModel):
    profile: dict | None = None
    location: str | None = None


def _annotate_saved(jobs: list[dict], user_id: str) -> list[dict]:
    saved = saved_job_ids(user_id)
    return [{**job, "saved": job.get("id") in saved} for job in jobs]


@router.post("/search-jobs", status_code=202)
def start_search(req: SearchRequest, background: BackgroundTasks, user: CurrentUser = Depends(get_current_user)):
    profile = req.profile
    if not profile:
        up = get_user_profile(user.id)
        profile = (up or {}).get("parsed_profile")
    if not profile:
        raise HTTPException(status_code=400, detail="Describe yourself first so we know what to search for.")

    keywords = derive_keywords(profile)
    if not keywords:
        raise HTTPException(status_code=400, detail="We couldn't derive search keywords from your profile. Add a few skills or a role you're aiming for.")
    location = derive_location(profile, req.location)

    charge_result = charge(user, ACTION_SEARCH)
    try:
        run = create_search_run(user.id, profile, keywords, location)
    except Exception as e:  # noqa: BLE001
        refund(user, ACTION_SEARCH)
        raise HTTPException(status_code=500, detail="Could not start the search. Please try again.") from e

    background.add_task(execute_search, run["id"], user.id, profile, keywords, location)
    return {"run_id": run["id"], "keywords": keywords, "location": location, "credits": charge_result}


@router.get("/search-jobs/{run_id}")
def search_status(run_id: str, user: CurrentUser = Depends(get_current_user)):
    run = get_search_run(run_id, user.id)
    if not run:
        raise HTTPException(status_code=404, detail="Search not found.")
    payload = {
        "run_id": run["id"],
        "status": run["status"],
        "stage": run.get("stage"),
        "progress": run.get("progress") or 0,
        "cache_hit": run.get("cache_hit"),
        "keywords": run.get("keywords"),
        "location": run.get("location"),
        "error": run.get("error"),
        "total": run.get("total") or 0,
        "created_at": run.get("created_at"),
        "completed_at": run.get("completed_at"),
    }
    if run["status"] == "done":
        payload["jobs"] = _annotate_saved(run.get("jobs") or [], user.id)
    return payload


@router.get("/search-jobs")
def recent_searches(user: CurrentUser = Depends(get_current_user)):
    return {"runs": list_search_runs(user.id, limit=10)}


@router.get("/matches/recent")
def recent_matches(limit: int = 6, user: CurrentUser = Depends(get_current_user)):
    runs = list_search_runs(user.id, limit=3, with_jobs=True)
    for run in runs:
        if run.get("status") == "done" and run.get("jobs"):
            jobs = _annotate_saved(run["jobs"], user.id)
            return {"run_id": run["id"], "searched_at": run.get("created_at"), "jobs": jobs[:limit], "total": run.get("total") or len(jobs)}
    return {"run_id": None, "searched_at": None, "jobs": [], "total": 0}
