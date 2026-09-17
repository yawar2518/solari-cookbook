"""Central settings for the fyt backend.

Everything secret or environment-specific comes from the process environment
(loaded from .env in development). Nothing here is hardcoded.
"""

import os
from dataclasses import dataclass, field

from dotenv import load_dotenv

load_dotenv()


def _csv(value: str) -> list[str]:
    return [v.strip().lower() for v in value.split(",") if v.strip()]


@dataclass(frozen=True)
class Settings:
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
    solari_api_key: str = os.getenv("SOLARI_API_KEY", "")

    supabase_url: str = os.getenv("SUPABASE_URL", "")
    supabase_service_role_key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    # The spec pins claude-sonnet-4-6 for every LLM task. Override via env if
    # you want to test another model without touching code.
    claude_model: str = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-6")

    # Comma-separated list. Anyone here gets /admin regardless of the DB flag.
    admin_emails: list[str] = field(default_factory=lambda: _csv(os.getenv("ADMIN_EMAILS", "")))

    # Origins allowed to call this API directly. In production the Next.js
    # server proxies every call, so only that origin is needed.
    cors_origins: list[str] = field(
        default_factory=lambda: [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
    )

    # Optional shared secret. When set, requests must carry X-Internal-Secret
    # so nobody can bypass the Next.js proxy and hit the API directly.
    internal_api_secret: str = os.getenv("INTERNAL_API_SECRET", "")

    job_cache_ttl_hours: int = int(os.getenv("JOB_CACHE_TTL_HOURS", "6"))
    job_details_ttl_days: int = int(os.getenv("JOB_DETAILS_TTL_DAYS", "7"))
    company_research_ttl_days: int = int(os.getenv("COMPANY_RESEARCH_TTL_DAYS", "7"))

    free_searches_per_day: int = int(os.getenv("FREE_SEARCHES_PER_DAY", "3"))
    free_cover_letters_per_day: int = int(os.getenv("FREE_COVER_LETTERS_PER_DAY", "3"))

    scrape_timeout_seconds: int = int(os.getenv("SCRAPE_TIMEOUT_SECONDS", "300"))

    # Approximate list prices used only for the admin cost chart.
    price_input_per_mtok: float = float(os.getenv("PRICE_INPUT_PER_MTOK", "3.0"))
    price_output_per_mtok: float = float(os.getenv("PRICE_OUTPUT_PER_MTOK", "15.0"))

    def validate(self) -> list[str]:
        """Return a list of human-readable problems with the configuration."""
        problems = []
        if not self.anthropic_api_key:
            problems.append("ANTHROPIC_API_KEY is not set")
        if not self.solari_api_key:
            problems.append("SOLARI_API_KEY is not set")
        if not self.supabase_url:
            problems.append("SUPABASE_URL is not set")
        if not self.supabase_service_role_key:
            problems.append("SUPABASE_SERVICE_ROLE_KEY is not set")
        return problems


settings = Settings()
