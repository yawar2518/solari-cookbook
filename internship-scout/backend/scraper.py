import asyncio
import os
import re
from dotenv import load_dotenv
from solari_browser import Solari
from playwright.async_api import TimeoutError as PlaywrightTimeout

load_dotenv()


async def scrape_linkedin(page, keyword: str, location: str) -> list[dict]:
    jobs = []
    try:
        query = keyword.replace(" ", "+")
        loc = location.replace(" ", "+") if location else "Worldwide"
        url = f"https://www.linkedin.com/jobs/search/?keywords={query}&location={loc}&f_TPR=r86400&sortBy=DD"

        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(4000)

        cards = await page.query_selector_all(".job-search-card")

        for card in cards[:8]:
            try:
                title = await card.query_selector(".base-search-card__title")
                company = await card.query_selector(".base-search-card__subtitle")
                location_el = await card.query_selector(".job-search-card__location")
                link = await card.query_selector("a.base-card__full-link")
                date_el = await card.query_selector("time")

                title_text = await title.inner_text() if title else "N/A"
                company_text = await company.inner_text() if company else "N/A"
                location_text = await location_el.inner_text() if location_el else "N/A"
                href = await link.get_attribute("href") if link else ""
                date_text = await date_el.get_attribute("datetime") if date_el else ""

                jobs.append({
                    "title": title_text.strip(),
                    "company": company_text.strip(),
                    "location": location_text.strip(),
                    "snippet": "",
                    "posted": date_text,
                    "url": href.split("?")[0] if href else "",
                    "source": "LinkedIn"
                })
            except Exception:
                continue

    except PlaywrightTimeout:
        print(f"[LinkedIn] Timeout for keyword: {keyword}")
    except Exception as e:
        print(f"[LinkedIn] Error: {e}")

    return jobs


async def scrape_internshala(page, keyword: str, location: str) -> list[dict]:
    jobs = []
    try:
        slug = keyword.lower().strip()
        slug = re.sub(r"[^a-z0-9\s-]", "", slug)
        slug = re.sub(r"\s+", "-", slug).strip("-")
        url = f"https://internshala.com/internships/{slug}-internship"

        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(3000)

        cards = await page.query_selector_all(".internship_meta")

        for card in cards[:8]:
            try:
                title = await card.query_selector(".profile")
                company = await card.query_selector(".company_name")
                location_el = await card.query_selector(".location_link")
                stipend = await card.query_selector(".stipend")
                link = await card.query_selector("a.view_detail_button")

                title_text = await title.inner_text() if title else "N/A"
                company_text = await company.inner_text() if company else "N/A"
                location_text = await location_el.inner_text() if location_el else "N/A"
                stipend_text = await stipend.inner_text() if stipend else "N/A"
                href = await link.get_attribute("href") if link else ""

                jobs.append({
                    "title": title_text.strip(),
                    "company": company_text.strip(),
                    "location": location_text.strip(),
                    "snippet": f"Stipend: {stipend_text.strip()}",
                    "posted": "",
                    "url": f"https://internshala.com{href}" if href else "",
                    "source": "Internshala"
                })
            except Exception:
                continue

    except PlaywrightTimeout:
        print(f"[Internshala] Timeout for keyword: {keyword}")
    except Exception as e:
        print(f"[Internshala] Error: {e}")

    return jobs


async def scrape_rozee(page, keyword: str, location: str) -> list[dict]:
    jobs = []
    try:
        query = keyword.replace(" ", "+")
        url = f"https://www.rozee.pk/job/jsearch/q/{query}"

        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(3000)

        cards = await page.query_selector_all(".job-item")

        for card in cards[:8]:
            try:
                title = await card.query_selector(".job-title")
                company = await card.query_selector(".company-name")
                location_el = await card.query_selector(".location")
                link = await card.query_selector("a")

                title_text = await title.inner_text() if title else "N/A"
                company_text = await company.inner_text() if company else "N/A"
                location_text = await location_el.inner_text() if location_el else "N/A"
                href = await link.get_attribute("href") if link else ""

                jobs.append({
                    "title": title_text.strip(),
                    "company": company_text.strip(),
                    "location": location_text.strip(),
                    "snippet": "",
                    "posted": "",
                    "url": href if href else "",
                    "source": "Rozee.pk"
                })
            except Exception:
                continue

    except PlaywrightTimeout:
        print(f"[Rozee] Timeout for keyword: {keyword}")
    except Exception as e:
        print(f"[Rozee] Error: {e}")

    return jobs


async def scrape_all(keywords: list[str], location: str = "") -> list[dict]:
    solari = Solari(api_key=os.environ["SOLARI_API_KEY"])
    all_jobs = []
    seen_urls = set()

    browser = await solari.launch(stealth=True, proxy="us", captcha=True)
    try:
        tasks = []
        pages = []

        for keyword in keywords[:3]:
            page_linkedin = await browser.new_page()
            page_internshala = await browser.new_page()
            page_rozee = await browser.new_page()
            pages.extend([page_linkedin, page_internshala, page_rozee])

            tasks.append(scrape_linkedin(page_linkedin, keyword, location))
            tasks.append(scrape_internshala(page_internshala, keyword, location))
            tasks.append(scrape_rozee(page_rozee, keyword, location))

        results = await asyncio.gather(*tasks)

        for result in results:
            for job in result:
                if job["url"] and job["url"] not in seen_urls:
                    seen_urls.add(job["url"])
                    all_jobs.append(job)

        for page in pages:
            await page.close()

    finally:
        await browser.close()

    return all_jobs


if __name__ == "__main__":
    async def test():
        print("Testing scraper...\n")
        keywords = ["Python intern", "AI automation intern"]
        jobs = await scrape_all(keywords, location="Remote")

        print(f"\nFound {len(jobs)} jobs:\n")
        for job in jobs:
            print(f"[{job['source']}] {job['title']} @ {job['company']}")
            print(f"  Location: {job['location']}")
            print(f"  URL: {job['url']}")
            print()

    asyncio.run(test())