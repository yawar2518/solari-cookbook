"""Shared Claude helpers.

context_parser.py and matcher.py keep their own clients (they predate this
module and work). Everything new goes through here so token usage is recorded
consistently and JSON parsing is handled in one place.
"""

from __future__ import annotations

import json
import re
from typing import Any, Iterator

import anthropic

from config import settings
from db import record_llm_usage

client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
MODEL = settings.claude_model


class LLMError(Exception):
    pass


def _strip_fences(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```[a-zA-Z]*\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)
    return raw.strip()


def parse_json(raw: str) -> Any:
    text = _strip_fences(raw)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to recover the outermost JSON object/array.
        start = min([i for i in (text.find("{"), text.find("[")) if i != -1], default=-1)
        end = max(text.rfind("}"), text.rfind("]"))
        if start != -1 and end > start:
            return json.loads(text[start : end + 1])
        raise


def _record(user_id: str | None, action: str, message: anthropic.types.Message) -> None:
    usage = getattr(message, "usage", None)
    if usage:
        record_llm_usage(user_id, action, MODEL, usage.input_tokens or 0, usage.output_tokens or 0)


def _text_of(message: anthropic.types.Message) -> str:
    return "".join(block.text for block in message.content if block.type == "text").strip()


def complete(
    *,
    system: str,
    user: str,
    max_tokens: int = 2000,
    action: str = "generic",
    user_id: str | None = None,
    temperature: float | None = None,
) -> str:
    kwargs: dict[str, Any] = {}
    if temperature is not None:
        kwargs["temperature"] = temperature
    try:
        message = client.messages.create(
            model=MODEL,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
            **kwargs,
        )
    except anthropic.RateLimitError as e:
        raise LLMError("Claude is rate-limited right now. Please try again in a moment.") from e
    except anthropic.APIStatusError as e:
        raise LLMError(f"Claude API error ({e.status_code}): {e.message}") from e
    except anthropic.APIConnectionError as e:
        raise LLMError("Could not reach the Claude API.") from e
    _record(user_id, action, message)
    if message.stop_reason == "refusal":
        raise LLMError("Claude declined to generate this content.")
    return _text_of(message)


def complete_json(
    *,
    system: str,
    user: str,
    max_tokens: int = 3000,
    action: str = "generic_json",
    user_id: str | None = None,
) -> Any:
    raw = complete(system=system, user=user, max_tokens=max_tokens, action=action, user_id=user_id)
    try:
        return parse_json(raw)
    except json.JSONDecodeError:
        # One repair pass: ask the model to fix its own output.
        repaired = complete(
            system="You fix malformed JSON. Return ONLY valid JSON, no prose, no fences.",
            user=f"Fix this JSON so it parses:\n\n{raw}",
            max_tokens=max_tokens,
            action=f"{action}_repair",
            user_id=user_id,
        )
        return parse_json(repaired)


def stream_text(
    *,
    system: str,
    user: str,
    max_tokens: int = 1200,
    action: str = "stream",
    user_id: str | None = None,
) -> Iterator[str]:
    """Yield text chunks as Claude produces them. Records usage at the end."""
    try:
        with client.messages.stream(
            model=MODEL,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
        ) as stream:
            for chunk in stream.text_stream:
                yield chunk
            final = stream.get_final_message()
            _record(user_id, action, final)
    except anthropic.RateLimitError as e:
        raise LLMError("Claude is rate-limited right now. Please try again in a moment.") from e
    except anthropic.APIStatusError as e:
        raise LLMError(f"Claude API error ({e.status_code}): {e.message}") from e
    except anthropic.APIConnectionError as e:
        raise LLMError("Could not reach the Claude API.") from e


def complete_with_web_search(
    *,
    system: str,
    user: str,
    max_tokens: int = 3000,
    max_uses: int = 4,
    action: str = "web_research",
    user_id: str | None = None,
) -> str:
    """Single-turn request with Anthropic's server-side web search tool.

    Falls back to the basic tool variant, then to no search, so company
    research always returns something rather than failing outright.
    """
    for tool_type in ("web_search_20260209", "web_search_20250305", None):
        tools = [{"type": tool_type, "name": "web_search", "max_uses": max_uses}] if tool_type else []
        try:
            message = client.messages.create(
                model=MODEL,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": user}],
                tools=tools,
            )
        except anthropic.BadRequestError:
            continue
        except anthropic.RateLimitError as e:
            raise LLMError("Claude is rate-limited right now. Please try again in a moment.") from e
        except anthropic.APIStatusError as e:
            raise LLMError(f"Claude API error ({e.status_code}): {e.message}") from e
        except anthropic.APIConnectionError as e:
            raise LLMError("Could not reach the Claude API.") from e
        _record(user_id, action, message)
        return _text_of(message)
    raise LLMError("Web research is unavailable.")
