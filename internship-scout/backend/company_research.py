"""Company research panel (Pro): Claude + server-side web search."""

from __future__ import annotations

from db import get_company_research, set_company_research, stable_hash
from llm import complete_with_web_search, parse_json

RESEARCH_SYSTEM = """You are a career researcher preparing a candidate for a job application.

Use web search (at most 4 searches) to learn about the company, then combine it with the job description.
Search for: the company's website/about page, size and funding, tech stack, and its Glassdoor rating.

Return ONLY a valid JSON object with this exact structure (no markdown fences, no preamble):
{
  "company_overview": "2 sentences on what the company does",
  "company_size": "string, e.g. '50-200 employees' or 'unknown'",
  "company_type": "one of: startup, scale-up, mid-size, enterprise, agency, non-profit, unknown",
  "industry": "string",
  "headquarters": "string or null",
  "tech_stack": ["list", "of", "technologies"],
  "day_to_day": ["3-5 bullets describing what this role would actually involve day to day"],
  "culture_signals": ["3-5 short bullets inferred from the job description and public info"],
  "glassdoor_rating": "number as string like '4.1' or null if not found",
  "glassdoor_note": "one short sentence on what reviews emphasise, or null",
  "interview_tips": ["3 concrete tips for this specific company/role"],
  "red_flags": ["0-3 honest concerns, empty array if none"],
  "sources": ["urls you actually used"]
}

Rules: be specific, be honest, prefer 'unknown'/null over guessing. Return only the JSON."""


def research_company(*, company: str, job_title: str, location: str, description: str | None, user_id: str) -> dict:
    key = stable_hash(company.strip().lower(), job_title.strip().lower())
    cached = get_company_research(key)
    if cached:
        return {**cached, "cached": True}

    user = f"""Company: {company}
Role: {job_title}
Location: {location}

Job description (may be partial):
{(description or 'Not available — rely on public information about the company and the role title.')[:6000]}
"""
    raw = complete_with_web_search(system=RESEARCH_SYSTEM, user=user, max_tokens=3000, max_uses=4, action="company_research", user_id=user_id)
    try:
        research = parse_json(raw)
    except Exception:  # noqa: BLE001
        research = {
            "company_overview": raw[:600],
            "company_size": "unknown",
            "company_type": "unknown",
            "industry": "unknown",
            "headquarters": None,
            "tech_stack": [],
            "day_to_day": [],
            "culture_signals": [],
            "glassdoor_rating": None,
            "glassdoor_note": None,
            "interview_tips": [],
            "red_flags": [],
            "sources": [],
        }
    if not isinstance(research, dict):
        research = {"company_overview": str(research)}
    set_company_research(key, company, job_title, research)
    return {**research, "cached": False}
