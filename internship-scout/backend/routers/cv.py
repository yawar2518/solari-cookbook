"""/cv — upload & review, ATS rewrite (Pro), generate from form, PDF export."""

from __future__ import annotations

import hashlib
import re
import time

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from auth import CurrentUser, get_current_user, require_pro
from context_parser import parse_user_context
from cv_service import ats_rewrite, extract_text, generate_cv, render_cv_pdf, structure_uploaded_cv
from db import get_supabase, get_user_profile, record_llm_usage, upsert_user_profile
from llm import MODEL, LLMError

router = APIRouter(prefix="/cv", tags=["cv"])

MAX_UPLOAD_BYTES = 8 * 1024 * 1024
ALLOWED_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
ALLOWED = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
}


class RewriteRequest(BaseModel):
    cv: dict | None = None
    target_role: str | None = None


class GenerateRequest(BaseModel):
    form: dict


class PdfRequest(BaseModel):
    cv: dict


class SaveCvRequest(BaseModel):
    cv: dict


def _signed_url(path: str | None) -> str | None:
    if not path:
        return None
    try:
        res = get_supabase().storage.from_("cvs").create_signed_url(path, 3600)
        return res.get("signedURL") or res.get("signedUrl") or res.get("signed_url")
    except Exception:  # noqa: BLE001
        return None


@router.get("")
def get_cv(user: CurrentUser = Depends(get_current_user)):
    up = get_user_profile(user.id) or {}
    return {
        "cv_filename": up.get("cv_filename"),
        "cv_download_url": _signed_url(up.get("cv_url")),
        "cv_parsed": up.get("cv_parsed"),
        "cv_suggestions": up.get("cv_suggestions"),
        "generated_cv": up.get("generated_cv"),
        "has_profile": bool(up.get("parsed_profile")),
    }


@router.post("/upload")
async def upload(file: UploadFile = File(...), user: CurrentUser = Depends(get_current_user)):
    content_type = file.content_type or ""
    filename = file.filename or "cv"
    ext = ALLOWED.get(content_type)
    if not ext:
        lowered = filename.lower()
        ext = ".pdf" if lowered.endswith(".pdf") else ".docx" if lowered.endswith(".docx") else None
    if not ext:
        raise HTTPException(status_code=415, detail="Please upload a PDF or DOCX file.")

    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="That file is over 8 MB. Please upload a smaller CV.")
    if not data:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    try:
        text = extract_text(filename if filename.lower().endswith(ext) else filename + ext, data)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    try:
        result = structure_uploaded_cv(text, user.id)
    except (LLMError, ValueError) as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    # Store the original in private storage; path = {user_id}/{timestamp}-{safe name}
    safe_name = re.sub(r"[^A-Za-z0-9._-]+", "-", filename)[:80]
    path = f"{user.id}/{int(time.time())}-{safe_name}"
    stored_path = None
    try:
        get_supabase().storage.from_("cvs").upload(
            path, data, {"content-type": content_type or ("application/pdf" if ext == ".pdf" else ALLOWED_DOCX), "upsert": "true"}
        )
        stored_path = path
    except Exception:  # noqa: BLE001
        stored_path = None  # Storage is optional; the parsed content is what matters.

    fields = {
        "cv_filename": filename,
        "cv_parsed": result.get("cv"),
        "cv_suggestions": result.get("review"),
    }
    if stored_path:
        fields["cv_url"] = stored_path

    # Auto-populate the plain-English profile from the CV if the user has none yet.
    up = get_user_profile(user.id) or {}
    profile_populated = False
    context_summary = result.get("context_summary")
    if context_summary and not up.get("parsed_profile"):
        try:
            parsed = parse_user_context(context_summary)
            record_llm_usage(user.id, "parse_context_from_cv", MODEL, len(context_summary) // 4 + 700, 600)
            fields["raw_context"] = context_summary
            fields["context_hash"] = hashlib.sha256(context_summary.encode("utf-8")).hexdigest()
            fields["parsed_profile"] = parsed
            profile_populated = True
        except Exception:  # noqa: BLE001
            pass

    upsert_user_profile(user.id, **fields)
    return {
        "cv": result.get("cv"),
        "review": result.get("review"),
        "context_summary": context_summary,
        "profile_populated": profile_populated,
        "stored": bool(stored_path),
    }


@router.post("/ats-rewrite")
def rewrite(req: RewriteRequest, user: CurrentUser = Depends(require_pro)):
    cv = req.cv or (get_user_profile(user.id) or {}).get("cv_parsed")
    if not cv:
        raise HTTPException(status_code=400, detail="Upload a CV first.")
    try:
        improved = ats_rewrite(cv, req.target_role, user.id)
    except (LLMError, ValueError) as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    upsert_user_profile(user.id, generated_cv=improved)
    return {"cv": improved}


@router.post("/generate")
def generate(req: GenerateRequest, user: CurrentUser = Depends(get_current_user)):
    form = req.form or {}
    personal = form.get("personal") or {}
    if not personal.get("name") or not personal.get("email"):
        raise HTTPException(status_code=400, detail="Name and email are required.")
    try:
        cv = generate_cv(form, user.id)
    except (LLMError, ValueError) as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    upsert_user_profile(user.id, generated_cv=cv)
    return {"cv": cv}


@router.put("/generated")
def save_generated(req: SaveCvRequest, user: CurrentUser = Depends(get_current_user)):
    if not req.cv:
        raise HTTPException(status_code=400, detail="Nothing to save.")
    upsert_user_profile(user.id, generated_cv=req.cv)
    return {"ok": True}


@router.post("/pdf")
def pdf(req: PdfRequest, user: CurrentUser = Depends(get_current_user)):
    if not req.cv:
        raise HTTPException(status_code=400, detail="Nothing to render.")
    try:
        data = render_cv_pdf(req.cv)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Could not render the PDF: {e}") from e
    name = re.sub(r"[^A-Za-z0-9]+", "_", ((req.cv.get("contact") or {}).get("name") or "CV")).strip("_") or "CV"
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{name}_CV.pdf"'},
    )
