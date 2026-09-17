"""/me, /parse-context, /profile — who the user is and how fyt sees them."""

from __future__ import annotations

import hashlib

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import CurrentUser, get_current_user
from context_parser import parse_user_context
from credits import usage_summary
from db import get_user_profile, record_llm_usage, upsert_user_profile, user_stats
from llm import MODEL

router = APIRouter(tags=["profile"])


class ContextRequest(BaseModel):
    context: str = Field(..., min_length=1)
    force: bool = False


class ProfileUpdate(BaseModel):
    parsed_profile: dict


def completeness(user_profile: dict | None, user: CurrentUser) -> dict:
    """Profile completeness score + suggestions for the dashboard right rail."""
    parsed = (user_profile or {}).get("parsed_profile") or {}
    checks = [
        ("context", bool((user_profile or {}).get("raw_context")), 25, "Describe yourself in plain English", "/search"),
        ("skills", bool((parsed.get("skills") or {}).get("confirmed")), 15, "Add your confirmed skills", "/search"),
        ("education", bool((parsed.get("education") or {}).get("field")), 10, "Add your field of study", "/search"),
        ("experience", bool((parsed.get("experience") or {}).get("highlights")), 10, "Mention a project, internship, or freelance work", "/search"),
        ("preferences", bool((parsed.get("preferences") or {}).get("job_type")), 10, "Say whether you want an internship or a job", "/search"),
        ("location", bool((parsed.get("preferences") or {}).get("location_type")), 5, "Tell us remote, onsite, or hybrid", "/search"),
        ("cv", bool((user_profile or {}).get("cv_url") or (user_profile or {}).get("generated_cv")), 20, "Upload or generate your CV", "/cv"),
        ("name", bool(user.full_name), 5, "Add your name to your account", "/dashboard"),
    ]
    score = sum(weight for _, ok, weight, _, _ in checks if ok)
    suggestions = [{"key": key, "label": label, "href": href, "weight": weight} for key, ok, weight, label, href in checks if not ok]
    return {"score": score, "suggestions": suggestions[:4]}


@router.get("/me")
def me(user: CurrentUser = Depends(get_current_user)):
    up = get_user_profile(user.id)
    return {
        "user": user.to_dict(),
        "usage": usage_summary(user),
        "profile": {
            "raw_context": (up or {}).get("raw_context"),
            "parsed_profile": (up or {}).get("parsed_profile"),
            "has_cv": bool((up or {}).get("cv_url")),
            "cv_filename": (up or {}).get("cv_filename"),
            "has_generated_cv": bool((up or {}).get("generated_cv")),
            "updated_at": (up or {}).get("updated_at"),
        },
        "stats": user_stats(user.id),
        "completeness": completeness(up, user),
    }


@router.post("/parse-context")
def parse_context(req: ContextRequest, user: CurrentUser = Depends(get_current_user)):
    text = req.context.strip()
    if len(text) < 20:
        raise HTTPException(status_code=400, detail="Tell us a little more — at least a sentence or two about yourself.")
    if len(text) > 6000:
        raise HTTPException(status_code=400, detail="That's a lot! Please keep it under 6,000 characters.")

    context_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
    existing = get_user_profile(user.id)
    if existing and not req.force and existing.get("context_hash") == context_hash and existing.get("parsed_profile"):
        return {"profile": existing["parsed_profile"], "cached": True}

    try:
        profile = parse_user_context(text)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(e) or "Claude couldn't read that. Please try again.") from e

    # context_parser.py uses its own client; log an estimate so the admin chart stays honest.
    record_llm_usage(user.id, "parse_context", MODEL, len(text) // 4 + 700, 600)

    upsert_user_profile(user.id, raw_context=text, context_hash=context_hash, parsed_profile=profile)
    return {"profile": profile, "cached": False}


@router.put("/profile")
def update_profile(req: ProfileUpdate, user: CurrentUser = Depends(get_current_user)):
    if not isinstance(req.parsed_profile, dict) or not req.parsed_profile:
        raise HTTPException(status_code=400, detail="Profile must be a non-empty object.")
    upsert_user_profile(user.id, parsed_profile=req.parsed_profile)
    return {"ok": True, "profile": req.parsed_profile}
