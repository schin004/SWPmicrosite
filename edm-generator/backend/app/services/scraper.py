"""Careers@Gov vacancy retrieval.

This module retrieves currently *open* vacancies for a given agency (National
Parks Board by default) from the Careers@Gov portal.

Important, honest note on the data source
-----------------------------------------
Careers@Gov is a dynamic single-page application whose underlying search
endpoint and HTML markup are not part of a stable, documented public API and
can change without notice. This scraper therefore:

  1. Attempts a best-effort request to a configurable JSON search endpoint and
     normalises whatever it can parse.
  2. Falls back to parsing HTML with configurable heuristics.
  3. If the live source is unreachable or returns nothing usable (e.g. in a
     restricted network, or if the portal changes), it raises
     :class:`ScraperUnavailable`. The caller may then use the bundled sample
     dataset so the tool remains usable for demos and training.

Only currently open vacancies are returned; expired/closed listings and
duplicates are filtered out.
"""

from __future__ import annotations

import hashlib
import json
from datetime import date, datetime
from pathlib import Path
from typing import Dict, List, Optional

import httpx
from bs4 import BeautifulSoup

from ..config import Settings, get_settings
from ..logging_config import get_logger

logger = get_logger(__name__)

_SAMPLE_PATH = Path(__file__).resolve().parent.parent / "data" / "sample_vacancies.json"


class ScraperUnavailable(RuntimeError):
    """Raised when live vacancies could not be retrieved."""


def _make_external_id(title: str, apply_url: str) -> str:
    """Build a stable id for de-duplication.

    Prefers the application URL (unique per posting); falls back to a hash of
    the title so that identical postings collapse to one record.
    """
    basis = (apply_url or title).strip().lower()
    return hashlib.sha1(basis.encode("utf-8")).hexdigest()[:20]


def _is_open(closing_date: str) -> bool:
    """Return True if the closing date is today or in the future (or unknown).

    Unknown/empty closing dates are treated as open so we do not silently drop
    valid postings that simply lack a parseable date.
    """
    if not closing_date:
        return True
    parsed = _parse_date(closing_date)
    if parsed is None:
        return True
    return parsed >= date.today()


def _parse_date(value: str) -> Optional[date]:
    """Parse a variety of common date formats into a ``date``."""
    value = value.strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d %b %Y", "%d %B %Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return None


class CareersGovScraper:
    """Retrieves open vacancies for a configured agency."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings = settings or get_settings()

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #
    def fetch_open_vacancies(self) -> List[Dict]:
        """Return a list of normalised, de-duplicated, open vacancies.

        Raises
        ------
        ScraperUnavailable
            If no vacancies could be retrieved from the live source.
        """
        raw: List[Dict] = []
        try:
            raw = self._fetch_from_json_api()
        except Exception as exc:  # noqa: BLE001 - broad by design; we fall through
            logger.warning("JSON API retrieval failed: %s", exc)

        if not raw:
            try:
                raw = self._fetch_from_html()
            except Exception as exc:  # noqa: BLE001
                logger.warning("HTML retrieval failed: %s", exc)

        if not raw:
            raise ScraperUnavailable(
                "Could not retrieve vacancies from Careers@Gov."
            )

        return self._post_process(raw)

    # ------------------------------------------------------------------ #
    # Retrieval strategies
    # ------------------------------------------------------------------ #
    def _fetch_from_json_api(self) -> List[Dict]:
        """Attempt to retrieve vacancies from a JSON search endpoint."""
        params = {
            "agency": self.settings.careers_agency,
            "status": "open",
            "keyword": "",
            "limit": self.settings.max_vacancies,
        }
        headers = {"Accept": "application/json", "User-Agent": _USER_AGENT}
        logger.info(
            "Querying Careers@Gov JSON endpoint %s", self.settings.careers_search_url
        )
        with httpx.Client(timeout=self.settings.request_timeout) as client:
            resp = client.get(
                self.settings.careers_search_url, params=params, headers=headers
            )
            resp.raise_for_status()
            data = resp.json()
        return self._normalise_json(data)

    def _fetch_from_html(self) -> List[Dict]:
        """Attempt to retrieve vacancies by scraping the search results page."""
        url = f"{self.settings.careers_base_url}/search"
        params = {"agency": self.settings.careers_agency, "status": "open"}
        headers = {"User-Agent": _USER_AGENT}
        logger.info("Scraping Careers@Gov HTML page %s", url)
        with httpx.Client(
            timeout=self.settings.request_timeout, follow_redirects=True
        ) as client:
            resp = client.get(url, params=params, headers=headers)
            resp.raise_for_status()
            html = resp.text
        return self._normalise_html(html)

    # ------------------------------------------------------------------ #
    # Normalisation helpers
    # ------------------------------------------------------------------ #
    def _normalise_json(self, data) -> List[Dict]:
        """Normalise a JSON payload into our canonical vacancy dicts.

        Handles a few plausible response shapes without assuming one specific
        schema, since the portal's exact contract is not guaranteed.
        """
        records = None
        if isinstance(data, list):
            records = data
        elif isinstance(data, dict):
            for key in ("results", "jobs", "data", "items", "hits"):
                if isinstance(data.get(key), list):
                    records = data[key]
                    break
        if not records:
            return []

        out: List[Dict] = []
        for rec in records:
            if not isinstance(rec, dict):
                continue
            title = _first(rec, "title", "jobTitle", "positionTitle", "name")
            if not title:
                continue
            division = _first(
                rec, "division", "department", "businessUnit", "team", default=""
            )
            closing = _first(
                rec, "closingDate", "closing_date", "expiryDate", "endDate", default=""
            )
            description = _first(
                rec, "description", "jobDescription", "summary", "details", default=""
            )
            apply_url = _first(
                rec, "applyUrl", "url", "link", "jobUrl", default=""
            )
            if apply_url and apply_url.startswith("/"):
                apply_url = self.settings.careers_base_url + apply_url
            out.append(
                {
                    "title": _clean(title),
                    "division": _clean(division),
                    "closing_date": _clean(str(closing)),
                    "description": _clean(description),
                    "apply_url": apply_url or self.settings.careers_base_url,
                }
            )
        return out

    def _normalise_html(self, html: str) -> List[Dict]:
        """Best-effort extraction of vacancy cards from a results page.

        Selectors are intentionally generic; adjust them if the portal markup
        is known. Returns an empty list if nothing recognisable is found.
        """
        soup = BeautifulSoup(html, "lxml")
        out: List[Dict] = []
        candidates = soup.select(
            "[data-testid='job-card'], .job-card, article, li.job, .search-result"
        )
        for node in candidates:
            title_el = node.select_one("h1, h2, h3, .job-title, [class*='title']")
            if not title_el:
                continue
            title = _clean(title_el.get_text())
            if not title:
                continue
            link_el = node.select_one("a[href]")
            apply_url = link_el["href"] if link_el else ""
            if apply_url.startswith("/"):
                apply_url = self.settings.careers_base_url + apply_url
            division = _text_for(node, "division", "department")
            closing = _text_for(node, "closing", "expiry", "deadline")
            description = _clean(node.get_text(" "))
            out.append(
                {
                    "title": title,
                    "division": division,
                    "closing_date": closing,
                    "description": description,
                    "apply_url": apply_url or self.settings.careers_base_url,
                }
            )
        return out

    def _post_process(self, raw: List[Dict]) -> List[Dict]:
        """Filter to open vacancies, de-duplicate, cap and assign ids."""
        seen = set()
        result: List[Dict] = []
        for rec in raw:
            if not _is_open(rec.get("closing_date", "")):
                continue  # Ignore expired/closed jobs.
            ext_id = _make_external_id(rec["title"], rec.get("apply_url", ""))
            if ext_id in seen:
                continue  # Avoid duplicate listings.
            seen.add(ext_id)
            rec["external_id"] = ext_id
            result.append(rec)
            if len(result) >= self.settings.max_vacancies:
                break
        logger.info("Retrieved %d open, de-duplicated vacancies", len(result))
        return result


# ---------------------------------------------------------------------- #
# Sample fallback
# ---------------------------------------------------------------------- #
def load_sample_vacancies() -> List[Dict]:
    """Load and normalise the bundled sample dataset.

    Used when the live source is unreachable so HR can still try the tool.
    """
    with _SAMPLE_PATH.open("r", encoding="utf-8") as fh:
        data = json.load(fh)
    for rec in data:
        rec.setdefault("external_id", _make_external_id(rec["title"], rec.get("apply_url", "")))
    logger.info("Loaded %d sample vacancies", len(data))
    return data


# ---------------------------------------------------------------------- #
# Small utilities
# ---------------------------------------------------------------------- #
_USER_AGENT = (
    "Mozilla/5.0 (compatible; NParks-eDM-Generator/1.0; +internal-mobility-tool)"
)


def _clean(text: Optional[str]) -> str:
    if not text:
        return ""
    return " ".join(str(text).split()).strip()


def _first(rec: Dict, *keys: str, default: str = "") -> str:
    for key in keys:
        val = rec.get(key)
        if val:
            return val
    return default


def _text_for(node, *hints: str) -> str:
    """Find text in a node whose class/label matches any of the hints."""
    for hint in hints:
        el = node.select_one(f"[class*='{hint}']")
        if el:
            return _clean(el.get_text())
    return ""
