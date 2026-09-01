import anthropic
import json
import os
from dotenv import load_dotenv

load_dotenv()

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

MATCH_SYSTEM_PROMPT = """You are an expert career advisor matching job listings to a candidate's profile.

Given a candidate profile and a list of job listings, rank ALL jobs from best to worst fit.

For each job return a rich analysis. Return ONLY a valid JSON array with this exact structure:

[
  {
    "job_index": 0,
    "match_score": 85,
    "match_label": "Strong Match",
    "matching_skills": ["skill1", "skill2"],
    "missing_skills": ["skill3"],
    "what_you_learn": "One sentence on what the candidate would gain from this role",
    "why_it_fits": "One sentence explaining why this role suits the candidate",
    "concern": "One sentence on the biggest gap or risk, or null if none"
  }
]

Rules:
- match_score: 0-100 integer
- match_label: one of [Strong Match, Good Match, Partial Match, Stretch Role]
- matching_skills: skills from the candidate profile that directly apply to this job
- missing_skills: important skills in the job the candidate lacks (max 3, empty array if none)
- what_you_learn: focus on growth, not just tasks
- concern: be honest about gaps, null if the match is near-perfect
- rank by match_score descending
- return ALL jobs in the array, no skipping
- return only the JSON array, no preamble, no markdown fences"""


def match_jobs(profile: dict, jobs: list[dict]) -> list[dict]:
    """
    Takes a parsed user profile and list of scraped jobs.
    Returns jobs ranked and enriched with match analysis.
    """
    if not jobs:
        return []

    # Build a clean job list for the prompt
    jobs_for_prompt = []
    for i, job in enumerate(jobs):
        jobs_for_prompt.append({
            "index": i,
            "title": job.get("title", ""),
            "company": job.get("company", ""),
            "location": job.get("location", ""),
            "snippet": job.get("snippet", ""),
            "source": job.get("source", "")
        })

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4000,
        system=MATCH_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": f"""Candidate Profile:
{json.dumps(profile, indent=2)}

Job Listings:
{json.dumps(jobs_for_prompt, indent=2)}

Rank all {len(jobs)} jobs for this candidate."""
            }
        ]
    )

    raw = message.content[0].text.strip()

    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    rankings = json.loads(raw)

    # Merge ranking data back into original job objects
    enriched_jobs = []
    for ranking in rankings:
        idx = ranking.get("job_index", 0)
        if idx < len(jobs):
            enriched_job = {**jobs[idx], **ranking}
            enriched_jobs.append(enriched_job)

    return enriched_jobs


if __name__ == "__main__":
    # Test with sample profile and jobs
    test_profile = {
        "education": {
            "level": "undergraduate",
            "field": "Software Engineering",
            "year": "7th semester"
        },
        "skills": {
            "confirmed": ["Python", "n8n", "Claude API", "LLM pipelines"],
            "inferred": ["REST APIs", "prompt engineering", "Git"]
        },
        "experience": {
            "level": "some experience",
            "highlights": ["Freelancing on Upwork", "Built LLM pipelines"]
        },
        "preferences": {
            "job_type": "internship",
            "location_type": "remote",
            "location_scope": "global"
        },
        "inferred_roles": [
            {"role": "AI Automation Engineer", "confidence": "high"},
            {"role": "Backend Developer Intern", "confidence": "medium"}
        ]
    }

    test_jobs = [
        {
            "title": "AI Automation Engineer Internship",
            "company": "QuantumBasel",
            "location": "Basel, Switzerland",
            "snippet": "Work on LLM pipelines and automation workflows",
            "source": "LinkedIn",
            "url": "https://linkedin.com/jobs/123"
        },
        {
            "title": "Python Developer Intern",
            "company": "Zenithbyte",
            "location": "India",
            "snippet": "Django, REST API development",
            "source": "LinkedIn",
            "url": "https://linkedin.com/jobs/456"
        },
        {
            "title": "Data Scientist Intern",
            "company": "Haystack",
            "location": "Washington DC",
            "snippet": "ML models, data analysis, Python",
            "source": "LinkedIn",
            "url": "https://linkedin.com/jobs/789"
        }
    ]

    print("Testing matcher...\n")
    results = match_jobs(test_profile, test_jobs)
    for job in results:
        print(f"[{job['match_score']}] {job['title']} @ {job['company']}")
        print(f"  Label: {job['match_label']}")
        print(f"  Matching: {job['matching_skills']}")
        print(f"  Missing: {job['missing_skills']}")
        print(f"  Why: {job['why_it_fits']}")
        print(f"  Learn: {job['what_you_learn']}")
        print(f"  Concern: {job['concern']}")
        print()