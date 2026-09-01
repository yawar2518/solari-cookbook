import asyncio
import os
from dotenv import load_dotenv
from solari_browser import Solari

load_dotenv()

async def main():
    solari = Solari(api_key=os.environ["SOLARI_API_KEY"])
    
    browser = await solari.launch()
    try:
        page = await browser.new_page()
        await page.goto("https://example.com")
        print("✓ Solari connected successfully")
        print("title  :", await page.title())
        print("session:", browser.id)
    finally:
        await browser.close()
        print("✓ Browser closed cleanly")

if __name__ == "__main__":
    asyncio.run(main())