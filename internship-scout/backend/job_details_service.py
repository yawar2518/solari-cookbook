"""Lazy fetch of a job's full description from its listing page.

Search results only carry title/company/location. When a user opens a job we
fetch the page once through Solari, cache the text for 7 days, and use it for
company research and cover letters.
"""

from __future__ import annotations

import asyncio
import concurrent.futures
import logging
import re

from scraper import _launch_browser  # reuse the stealth+fallback launcher
from solari_browser import Solari

from config import settings
from db import get_job_details, set_job_details

log = logging.getLogger("fyt.job_details")

_SELECTORS = [
    ".show-more-less-html__markup",  # LinkedIn public job page
    ".description__text",            # LinkedIn (older)
    ".internship_details",           # Internshala
    ".jbody",                        # Rozee.pk
    "#job-description",
    "article",
    "main",
]


def _clean(text: str) -> str:
    text = re.sub(r"[ \t ]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


async def _fetch(url: str) -> str | None:
    solari = Solari(api_key=settings.solari_api_key)
    browser = await _launch_browser(solari)
    try:
        page = await browser.new_page()
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(2500)
        # LinkedIn hides most of the description behind a "show more" button.
        try:
            btn = await page.query_selector("button.show-more-less-html__button--more")
            if btn:
                await btn.click()
                await page.wait_for_timeout(500)
        except Exception:  # noqa: BLE001
            pass
        for sel in _SELECTORS:
            el = await page.query_selector(sel)
            if el:
                text = _clean(await el.inner_text())
                if len(text) > 200:
                    return text[:12000]
        body = await page.query_selector("body")
        if body:
            text = _clean(await body.inner_text())
            return text[:8000] if len(text) > 200 else None
        return None
    finally:
        await browser.close()


def fetch_job_description(job_id: str, url: str) -> dict:
    cached = get_job_details(job_id)
    if cached:
        return {"description": cached.get("description"), "cached": True}

    if not url:
        return {"description": None, "cached": False}

    def worker():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(_fetch(url))
        finally:
            loop.close()

    description = None
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            description = executor.submit(worker).result(timeout=180)
    except Exception as e:  # noqa: BLE001
        log.warning("description fetch failed for %s: %s", url, e)

    set_job_details(job_id, url, description)
    return {"description": description, "cached": False}
