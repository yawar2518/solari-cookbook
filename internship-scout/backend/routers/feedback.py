"""/feedback and /waitlist."""

from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import CurrentUser, get_current_user, get_optional_user
from db import add_to_waitlist, insert_feedback

router = APIRouter(tags=["feedback"])

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class FeedbackRequest(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    message: str | None = Field(default=None, max_length=2000)
    page: str | None = Field(default=None, max_length=200)


class WaitlistRequest(BaseModel):
    email: str
    plan: str = "pro_monthly"


@router.post("/feedback", status_code=201)
def feedback(req: FeedbackRequest, user: CurrentUser = Depends(get_current_user)):
    insert_feedback(user.id, req.rating, (req.message or "").strip() or None, req.page)
    return {"ok": True}


@router.post("/waitlist", status_code=201)
def waitlist(req: WaitlistRequest, user: CurrentUser | None = Depends(get_optional_user)):
    email = req.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")
    if req.plan not in {"pro_monthly", "pro_yearly"}:
        raise HTTPException(status_code=400, detail="Unknown plan.")
    add_to_waitlist(email, req.plan, user.id if user else None)
    return {"ok": True}
