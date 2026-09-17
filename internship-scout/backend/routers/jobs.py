"""/jobs/{id}, /jobs/{id}/description, /jobs/{id}/research, /saved-jobs."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import CurrentUser, get_current_user
from company_research import research_company
from db import find_job_for_user, get_job_details, job_id_for, list_saved_jobs, save_job, saved_job_ids, unsave_job
from job_details_service import fetch_job_description
from llm import LLMError

router = APIRouter(tags=["jobs"])


class SaveJobRequest(BaseModel):
    job: dict
    notes: str | None = None


class NotesRequest(BaseModel):
    notes: str | None = None


@router.get("/jobs/{job_id}")
def get_job(job_id: str, user: CurrentUser = Depends(get_current_user)):
    job = find_job_for_user(user.id, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="We couldn't find that job. It may be from an older search — run a new one.")
    job["saved"] = job_id in saved_job_ids(user.id)
    details = get_job_details(job_id)
    job["description"] = details.get("description") if details else None
    return {"job": job}


@router.get("/jobs/{job_id}/description")
def get_description(job_id: str, user: CurrentUser = Depends(get_current_user)):
    job = find_job_for_user(user.id, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    result = fetch_job_description(job_id, job.get("url") or "")
    return result


@router.get("/jobs/{job_id}/research")
def get_research(job_id: str, user: CurrentUser = Depends(get_current_user)):
    job = find_job_for_user(user.id, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    if not user.is_pro:
        return {"locked": True, "research": None}
    details = get_job_details(job_id)
    description = details.get("description") if details else job.get("snippet")
    try:
        research = research_company(
            company=job.get("company") or "Unknown",
            job_title=job.get("title") or "",
            location=job.get("location") or "",
            description=description,
            user_id=user.id,
        )
    except LLMError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    return {"locked": False, "research": research}


@router.get("/saved-jobs")
def saved(user: CurrentUser = Depends(get_current_user)):
    rows = list_saved_jobs(user.id)
    return {"jobs": [{**r["job_data"], "id": r["job_id"], "notes": r.get("notes"), "saved_at": r.get("saved_at"), "saved": True} for r in rows]}


@router.post("/saved-jobs", status_code=201)
def save(req: SaveJobRequest, user: CurrentUser = Depends(get_current_user)):
    if not req.job or not (req.job.get("title") or req.job.get("url")):
        raise HTTPException(status_code=400, detail="That doesn't look like a job.")
    job = {**req.job}
    job["id"] = job.get("id") or job_id_for(job)
    row = save_job(user.id, job, req.notes)
    return {"ok": True, "job_id": row.get("job_id", job["id"])}


@router.patch("/saved-jobs/{job_id}")
def update_notes(job_id: str, req: NotesRequest, user: CurrentUser = Depends(get_current_user)):
    job = find_job_for_user(user.id, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    save_job(user.id, {k: v for k, v in job.items() if k not in {"saved", "run_id"}}, req.notes)
    return {"ok": True}


@router.delete("/saved-jobs/{job_id}")
def unsave(job_id: str, user: CurrentUser = Depends(get_current_user)):
    unsave_job(user.id, job_id)
    return {"ok": True}
