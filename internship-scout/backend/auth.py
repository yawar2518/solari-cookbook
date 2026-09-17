"""Authentication for the FastAPI backend.

The browser never talks to this API directly. The Next.js server proxies each
request and forwards the user's Supabase access token as a Bearer token. We
verify it by asking Supabase Auth (works with both HS256 and the newer
asymmetric signing keys) and cache the result briefly to avoid a round-trip on
every call.
"""

from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, Request

from config import settings
from db import ensure_profile, get_supabase, touch_last_active

_TOKEN_CACHE: dict[str, tuple[float, dict]] = {}
_TOKEN_TTL_SECONDS = 90


@dataclass
class CurrentUser:
    id: str
    email: str
    full_name: str | None
    avatar_url: str | None
    plan: str
    is_admin: bool
    search_credits: int
    cover_letter_credits: int
    created_at: str | None

    @property
    def is_pro(self) -> bool:
        return self.plan == "pro"

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "email": self.email,
            "full_name": self.full_name,
            "avatar_url": self.avatar_url,
            "plan": self.plan,
            "is_admin": self.is_admin,
            "search_credits": self.search_credits,
            "cover_letter_credits": self.cover_letter_credits,
            "created_at": self.created_at,
        }


def _verify_token(token: str) -> dict:
    key = hashlib.sha256(token.encode()).hexdigest()
    cached = _TOKEN_CACHE.get(key)
    now = time.time()
    if cached and cached[0] > now:
        return cached[1]
    try:
        res = get_supabase().auth.get_user(token)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=401, detail="Your session is invalid or has expired. Please sign in again.") from e
    user = getattr(res, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Your session is invalid or has expired. Please sign in again.")
    data = {
        "id": str(user.id),
        "email": user.email or "",
        "user_metadata": user.user_metadata or {},
    }
    # Evict stale entries opportunistically so the cache stays small.
    if len(_TOKEN_CACHE) > 500:
        for k, (exp, _) in list(_TOKEN_CACHE.items()):
            if exp <= now:
                _TOKEN_CACHE.pop(k, None)
    _TOKEN_CACHE[key] = (now + _TOKEN_TTL_SECONDS, data)
    return data


def check_internal_secret(request: Request) -> None:
    if not settings.internal_api_secret:
        return
    if request.headers.get("x-internal-secret") != settings.internal_api_secret:
        raise HTTPException(status_code=403, detail="Forbidden")


async def get_current_user(
    request: Request,
    authorization: str | None = Header(default=None),
) -> CurrentUser:
    check_internal_secret(request)
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Sign in to continue.")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Sign in to continue.")

    auth_user = _verify_token(token)
    profile = ensure_profile(auth_user)
    touch_last_active(auth_user["id"])

    email = (profile.get("email") or auth_user["email"] or "").lower()
    is_admin = bool(profile.get("is_admin")) or email in settings.admin_emails

    return CurrentUser(
        id=auth_user["id"],
        email=email,
        full_name=profile.get("full_name") or auth_user["user_metadata"].get("full_name") or auth_user["user_metadata"].get("name"),
        avatar_url=profile.get("avatar_url") or auth_user["user_metadata"].get("avatar_url"),
        plan=profile.get("plan") or "free",
        is_admin=is_admin,
        search_credits=int(profile.get("search_credits") or 0),
        cover_letter_credits=int(profile.get("cover_letter_credits") or 0),
        created_at=profile.get("created_at"),
    )


async def get_optional_user(
    request: Request,
    authorization: str | None = Header(default=None),
) -> CurrentUser | None:
    if not authorization:
        check_internal_secret(request)
        return None
    try:
        return await get_current_user(request, authorization)
    except HTTPException:
        return None


async def require_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access only.")
    return user


async def require_pro(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if not user.is_pro:
        raise HTTPException(status_code=402, detail="This feature is available on fyt Pro.")
    return user
