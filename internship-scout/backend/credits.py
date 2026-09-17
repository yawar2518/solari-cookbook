"""Credit and rate-limit enforcement.

Free users have two independent limits per action:
  * a daily cap (3 searches/day, 3 cover letters/day), and
  * a lifetime credit balance (10 searches, 3 cover letters at signup).
Both are checked atomically in the consume_credit() Postgres function.
Pro users are unlimited and never charged.
"""

from __future__ import annotations

from fastapi import HTTPException

from auth import CurrentUser
from config import settings
from db import consume_credit, refund_credit, usage_today

ACTION_SEARCH = "search"
ACTION_COVER_LETTER = "cover_letter"

_LIMITS = {
    ACTION_SEARCH: settings.free_searches_per_day,
    ACTION_COVER_LETTER: settings.free_cover_letters_per_day,
}

_LABELS = {
    ACTION_SEARCH: "search",
    ACTION_COVER_LETTER: "cover letter",
}


def charge(user: CurrentUser, action: str) -> dict:
    """Consume one credit or raise a 402/429 with a friendly message."""
    limit = _LIMITS[action]
    result = consume_credit(user.id, action, limit)
    if result.get("ok"):
        return result

    reason = result.get("reason")
    label = _LABELS[action]
    if reason == "daily_limit":
        raise HTTPException(
            status_code=429,
            detail=f"You've used your {limit} free {label}s for today. Upgrade to Pro for unlimited {label}s, or come back tomorrow.",
        )
    if reason == "no_credits":
        raise HTTPException(
            status_code=402,
            detail=f"You're out of {label} credits. Upgrade to Pro for unlimited {label}s.",
        )
    raise HTTPException(status_code=500, detail="Could not verify your credits. Please try again.")


def refund(user: CurrentUser, action: str) -> None:
    refund_credit(user.id, action)


def usage_summary(user: CurrentUser) -> dict:
    """What the header/dashboard show: remaining today + balance."""
    if user.is_pro:
        return {
            "plan": "pro",
            "searches": {"used_today": None, "limit_today": None, "balance": None, "unlimited": True},
            "cover_letters": {"used_today": None, "limit_today": None, "balance": None, "unlimited": True},
        }
    s_used = usage_today(user.id, ACTION_SEARCH)
    c_used = usage_today(user.id, ACTION_COVER_LETTER)
    return {
        "plan": "free",
        "searches": {
            "used_today": s_used,
            "limit_today": settings.free_searches_per_day,
            "remaining_today": max(0, settings.free_searches_per_day - s_used),
            "balance": user.search_credits,
            "unlimited": False,
        },
        "cover_letters": {
            "used_today": c_used,
            "limit_today": settings.free_cover_letters_per_day,
            "remaining_today": max(0, settings.free_cover_letters_per_day - c_used),
            "balance": user.cover_letter_credits,
            "unlimited": False,
        },
    }
