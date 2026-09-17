"""fyt API — FastAPI entry point.

Existing modules (context_parser.py, scraper.py, matcher.py) are integrated,
not rewritten. Endpoints live in routers/, cross-cutting concerns in auth.py,
credits.py, db.py and llm.py.
"""

from __future__ import annotations

import asyncio
import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from routers import admin, cover_letters, cv, feedback, jobs, profile, search

if sys.platform == "win32":
    # Playwright needs the Proactor loop on Windows. Worker threads create
    # their own loops (see search_service._run_scraper); this covers the main one.
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("fyt")


@asynccontextmanager
async def lifespan(_: FastAPI):
    for problem in settings.validate():
        log.warning("CONFIG: %s", problem)
    log.info("fyt API ready (model=%s, cache_ttl=%sh)", settings.claude_model, settings.job_cache_ttl_hours)
    yield


app = FastAPI(
    title="fyt API",
    version="1.0.0",
    description="Context-aware job and internship matching.",
    lifespan=lifespan,
    docs_url="/docs" if not settings.internal_api_secret else None,
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Tailored", "Content-Disposition"],
)


@app.exception_handler(RequestValidationError)
async def validation_handler(_: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    loc = ".".join(str(p) for p in first.get("loc", []) if p != "body")
    msg = first.get("msg", "Invalid request")
    return JSONResponse(status_code=422, content={"detail": f"{loc}: {msg}" if loc else msg})


@app.exception_handler(Exception)
async def unhandled_handler(_: Request, exc: Exception):
    log.exception("Unhandled error: %s", exc)
    return JSONResponse(status_code=500, content={"detail": "Something went wrong on our side. Please try again."})


@app.get("/")
def root():
    return {"status": "fyt API running", "version": app.version}


@app.get("/health")
def health():
    problems = settings.validate()
    return {"ok": not problems, "problems": problems, "model": settings.claude_model}


app.include_router(profile.router)
app.include_router(search.router)
app.include_router(jobs.router)
app.include_router(cover_letters.router)
app.include_router(cv.router)
app.include_router(feedback.router)
app.include_router(admin.router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
