"""/cover-letter (streamed), /cover-letter/cv-suggestions (Pro), /cover-letters."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from auth import CurrentUser, get_current_user, require_pro
from credits import ACTION_COVER_LETTER, charge, refund
from db import get_job_details, get_user_profile, insert_cover_letter, list_cover_letters
from llm import LLMError, complete_json, stream_text

router = APIRouter(tags=["cover-letters"])


class CoverLetterRequest(BaseModel):
    job: dict
    profile: dict | None = None


LETTER_SYSTEM = """You write cover letters for students and early-career candidates.

Rules:
- Exactly 3 short paragraphs, under 250 words total.
- Paragraph 1: who they are and why this role — one concrete reason, not flattery.
- Paragraph 2: 2-3 specific skills, projects, or experiences that match, with evidence.
- Paragraph 3: honest about any gap (framed as what they'll learn fast), then a clear call to action.
- Match the candidate's actual level: a 2nd-semester student sounds eager and project-driven, a 7th-semester freelancer sounds experienced. Never inflate.
- Absolutely no filler: never "I am writing to express my interest", "passionate", "dynamic", "leverage", "synergy".
- Conversational, professional, first person. Plain text only — no headers, no bullet points, no sign-off block beyond a simple name line.
- Output only the letter."""


def _candidate_block(profile: dict) -> str:
    edu = profile.get("education") or {}
    exp = profile.get("experience") or {}
    skills = profile.get("skills") or {}
    return f"""Summary: {profile.get('summary', '')}
Education: {edu.get('level', '')} in {edu.get('field', '')}, {edu.get('year', '')} at {edu.get('institution', '') or 'unspecified institution'}
Experience level: {exp.get('level', '')}
Highlights: {', '.join(exp.get('highlights') or []) or 'none listed'}
Confirmed skills: {', '.join(skills.get('confirmed') or [])}
Inferred skills: {', '.join(skills.get('inferred') or [])}"""


def _prompt_for(user: CurrentUser, profile: dict, job: dict) -> str:
    if user.is_pro:
        details = get_job_details(job.get("id") or "") if job.get("id") else None
        description = (details or {}).get("description") or job.get("snippet") or ""
        return f"""Candidate:
{_candidate_block(profile)}

Job:
Title: {job.get('title')}
Company: {job.get('company')}
Location: {job.get('location')}
Why it fits (from our matcher): {job.get('why_it_fits', '')}
Matching skills: {', '.join(job.get('matching_skills') or [])}
Missing skills: {', '.join(job.get('missing_skills') or [])}
Job description:
{description[:5000]}

Write a fully tailored cover letter that references specifics from the job description."""
    # Free tier: no job-specific tailoring beyond the title and company.
    return f"""Candidate:
{_candidate_block(profile)}

Job title: {job.get('title')}
Company: {job.get('company')}

Write a solid general cover letter for this role type. Do not invent details about the company."""


@router.post("/cover-letter")
def cover_letter(req: CoverLetterRequest, user: CurrentUser = Depends(get_current_user)):
    profile = req.profile or (get_user_profile(user.id) or {}).get("parsed_profile")
    if not profile:
        raise HTTPException(status_code=400, detail="Describe yourself on the Search page first so we know who you are.")
    job = req.job or {}
    if not job.get("title"):
        raise HTTPException(status_code=400, detail="Missing job details.")

    charge(user, ACTION_COVER_LETTER)
    prompt = _prompt_for(user, profile, job)

    def generate():
        collected: list[str] = []
        try:
            for chunk in stream_text(system=LETTER_SYSTEM, user=prompt, max_tokens=700, action="cover_letter", user_id=user.id):
                collected.append(chunk)
                yield chunk
        except LLMError as e:
            refund(user, ACTION_COVER_LETTER)
            yield f"\n\n[error] {e}"
            return
        letter = "".join(collected).strip()
        if letter:
            insert_cover_letter(user.id, job, letter, tailored=user.is_pro)

    headers = {"X-Tailored": "1" if user.is_pro else "0", "Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    return StreamingResponse(generate(), media_type="text/plain; charset=utf-8", headers=headers)


CV_SUGGEST_SYSTEM = """You are a recruiter helping a candidate tailor their CV to one job.

Return ONLY a valid JSON object (no fences):
{
  "headline": "one line: the angle this CV should take for this job",
  "keywords_to_add": ["5-10 exact keywords/phrases from the job description worth adding if truthful"],
  "bullets_to_rewrite": [
    {"current": "a bullet or claim the candidate already has (or 'new')", "suggested": "stronger rewrite aimed at this job", "why": "short reason"}
  ],
  "sections_to_reorder": "one sentence on what to move up/down, or null",
  "remove": ["things to cut for this application, empty if none"]
}
Never suggest lying. Keep suggestions concrete and specific to this job."""


@router.post("/cover-letter/cv-suggestions")
def cv_suggestions(req: CoverLetterRequest, user: CurrentUser = Depends(require_pro)):
    profile = req.profile or (get_user_profile(user.id) or {}).get("parsed_profile")
    if not profile:
        raise HTTPException(status_code=400, detail="Describe yourself first.")
    up = get_user_profile(user.id) or {}
    cv = up.get("generated_cv") or up.get("cv_parsed")
    job = req.job or {}
    details = get_job_details(job.get("id") or "") if job.get("id") else None
    description = (details or {}).get("description") or job.get("snippet") or ""
    user_prompt = f"""Candidate profile:
{_candidate_block(profile)}

Candidate CV (structured, may be null):
{json.dumps(cv, ensure_ascii=False)[:6000] if cv else 'null'}

Job:
Title: {job.get('title')}
Company: {job.get('company')}
Description:
{description[:5000]}"""
    try:
        result = complete_json(system=CV_SUGGEST_SYSTEM, user=user_prompt, max_tokens=2000, action="cv_tailor", user_id=user.id)
    except LLMError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    return {"suggestions": result}


@router.get("/cover-letters")
def history(user: CurrentUser = Depends(get_current_user)):
    return {"letters": list_cover_letters(user.id)}
