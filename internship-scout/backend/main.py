from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from context_parser import parse_user_context
from scraper import scrape_all
from matcher import match_jobs
import asyncio
import sys

if sys.platform == "win32":
    from asyncio import ProactorEventLoop
    loop = ProactorEventLoop()
    asyncio.set_event_loop(loop)
app = FastAPI(title="Internship Scout API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ContextRequest(BaseModel):
    context: str


class SearchRequest(BaseModel):
    profile: dict
    location: str = ""


class CoverLetterRequest(BaseModel):
    profile: dict
    job: dict


@app.get("/")
def root():
    return {"status": "Internship Scout API running"}


@app.post("/parse-context")
async def parse_context(req: ContextRequest):
    if not req.context or len(req.context.strip()) < 20:
        raise HTTPException(status_code=400, detail="Please provide more context.")
    try:
        profile = parse_user_context(req.context)
        return {"profile": profile}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/search-jobs")

async def search_jobs(req: SearchRequest):

    try:

        profile = req.profile

        keywords = profile.get("search_keywords", {})



        global_keywords = keywords.get("global", [])[:2]

        local_keywords = keywords.get("local", [])[:1]

        all_keywords = global_keywords + local_keywords



        if not all_keywords:

            raise HTTPException(status_code=400, detail="No search keywords in profile.")



        prefs = profile.get("preferences", {})

        location = ""

        if prefs.get("location_type") == "remote":

            location = "Remote"

        elif prefs.get("city"):

            location = f"{prefs['city']}, {prefs.get('country', '')}"

        elif prefs.get("country"):

            location = prefs["country"]



        # Run scraper in a separate thread with its own event loop

        import concurrent.futures



        def run_scraper():

            loop = asyncio.new_event_loop()

            asyncio.set_event_loop(loop)

            try:

                return loop.run_until_complete(scrape_all(all_keywords, location))

            finally:

                loop.close()



        with concurrent.futures.ThreadPoolExecutor() as executor:

            future = executor.submit(run_scraper)

            jobs = future.result(timeout=120)



        if not jobs:

            return {"jobs": [], "message": "No jobs found. Try adjusting your profile."}



        ranked_jobs = match_jobs(profile, jobs)

        return {"jobs": ranked_jobs, "total": len(ranked_jobs)}



    except HTTPException:

        raise

    except Exception as e:

        raise HTTPException(status_code=500, detail=str(e))


@app.post("/cover-letter")
async def cover_letter(req: CoverLetterRequest):
    try:
        from anthropic import Anthropic
        import os

        client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

        profile = req.profile
        job = req.job

        prompt = f"""Write a concise, professional cover letter for this candidate applying to this job.

Candidate Profile:
{profile}

Job:
Title: {job.get('title')}
Company: {job.get('company')}
Location: {job.get('location')}
Details: {job.get('snippet', '')}

Matching skills: {job.get('matching_skills', [])}
Missing skills: {job.get('missing_skills', [])}

Rules:
- 3 short paragraphs max
- First paragraph: who they are and why this role
- Second paragraph: 2-3 specific skills/experiences that match
- Third paragraph: enthusiasm and call to action
- Honest about gaps but frame them as learning opportunities
- No fluff, no generic phrases like "I am writing to express my interest"
- Conversational but professional tone
- Under 250 words"""

        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}]
        )

        return {"cover_letter": message.content[0].text.strip()}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))