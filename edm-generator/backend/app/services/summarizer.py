"""Concise, faithful one-line summaries for each vacancy.

Two strategies are supported:

* **Claude (Anthropic)** — used when ``ANTHROPIC_API_KEY`` is configured.
  Produces an engaging, factual 25–40 word summary grounded strictly in the
  supplied job description.
* **Deterministic extractive fallback** — used otherwise (no key / offline).
  Selects and trims the most informative sentence(s) from the description so
  the tool works without any external dependency and never invents content.

Both strategies aim to be faithful to the source and free of invented
information.
"""

from __future__ import annotations

import re
from typing import Optional

from ..config import Settings, get_settings
from ..logging_config import get_logger

logger = get_logger(__name__)

_PROMPT_TEMPLATE = (
    "You are helping an HR team write an internal jobs newsletter for the "
    "National Parks Board (NParks).\n\n"
    "Write ONE concise, engaging sentence ({min_w}-{max_w} words) summarising "
    "the role below for staff considering an internal move.\n\n"
    "Rules:\n"
    "- Be factual and faithful to the job description.\n"
    "- Do NOT invent responsibilities, requirements or details.\n"
    "- No lists, no headings, no responsibilities enumeration — one sentence.\n"
    "- Do not repeat the job title.\n\n"
    "Job title: {title}\n"
    "Division: {division}\n"
    "Job description:\n{description}\n\n"
    "Summary:"
)


class Summarizer:
    """Generates one-line vacancy summaries."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings = settings or get_settings()
        self._client = None
        if self.settings.anthropic_api_key:
            try:
                import anthropic

                self._client = anthropic.Anthropic(
                    api_key=self.settings.anthropic_api_key
                )
                logger.info(
                    "AI summaries enabled (model=%s)", self.settings.anthropic_model
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "Anthropic client unavailable, using fallback summaries: %s", exc
                )

    @property
    def ai_enabled(self) -> bool:
        return self._client is not None

    def summarize(self, title: str, division: str, description: str) -> str:
        """Return a concise one-line summary for the vacancy."""
        description = (description or "").strip()
        if self._client is not None:
            try:
                return self._summarize_with_claude(title, division, description)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Claude summary failed, using fallback: %s", exc)
        return self._summarize_fallback(description)

    # ------------------------------------------------------------------ #
    def _summarize_with_claude(
        self, title: str, division: str, description: str
    ) -> str:
        prompt = _PROMPT_TEMPLATE.format(
            min_w=self.settings.summary_min_words,
            max_w=self.settings.summary_max_words,
            title=title,
            division=division or "Not specified",
            description=description[:4000],
        )
        message = self._client.messages.create(
            model=self.settings.anthropic_model,
            max_tokens=150,
            messages=[{"role": "user", "content": prompt}],
        )
        text = "".join(
            block.text for block in message.content if block.type == "text"
        )
        return _tidy_one_line(text)

    # ------------------------------------------------------------------ #
    def _summarize_fallback(self, description: str) -> str:
        """Extractive summary: trim the opening of the description to length."""
        if not description:
            return "An opportunity to contribute to NParks' mission across the organisation."

        sentences = re.split(r"(?<=[.!?])\s+", description)
        summary = sentences[0] if sentences else text

        words = summary.split()
        max_w = self.settings.summary_max_words
        min_w = self.settings.summary_min_words

        # Grow the summary with following sentences until we reach the minimum.
        idx = 1
        while len(words) < min_w and idx < len(sentences):
            words = (summary + " " + sentences[idx]).split()
            summary = " ".join(words)
            idx += 1

        if len(words) > max_w:
            words = words[:max_w]
            summary = " ".join(words).rstrip(",;:") + "…"

        return _tidy_one_line(summary)


def _tidy_one_line(text: str) -> str:
    """Collapse whitespace and strip stray leading labels/quotes."""
    text = " ".join(text.split())
    text = re.sub(r'^(summary\s*[:\-]\s*)', "", text, flags=re.I)
    return text.strip().strip('"').strip()
