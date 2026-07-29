"""Vacancy refresh orchestration.

Ties together retrieval (scraper), summarisation and persistence. Used by both
the on-demand API endpoint and the optional scheduled refresh so the logic
lives in exactly one place.
"""

from __future__ import annotations

from datetime import datetime
from typing import Dict, List

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..logging_config import get_logger
from ..models import Vacancy
from ..schemas import RefreshResult
from .scraper import CareersGovScraper, ScraperUnavailable, load_sample_vacancies
from .summarizer import Summarizer

logger = get_logger(__name__)


def refresh_vacancies(db: Session) -> RefreshResult:
    """Retrieve current vacancies and upsert them into the database.

    * New vacancies are created (with an AI/fallback summary).
    * Existing vacancies are updated, but an HR-edited summary is preserved.
    * Vacancies no longer present in the source are marked closed (hidden).
    """
    settings = get_settings()
    scraper = CareersGovScraper(settings)
    summarizer = Summarizer(settings)

    source = "live"
    try:
        vacancies = scraper.fetch_open_vacancies()
    except ScraperUnavailable as exc:
        if not settings.use_sample_fallback:
            logger.error("Live retrieval failed and sample fallback disabled: %s", exc)
            return RefreshResult(
                ok=False,
                source="live",
                total_found=0,
                created=0,
                updated=0,
                closed=0,
                message=(
                    "Could not reach Careers@Gov and sample fallback is disabled. "
                    "Check network access / configuration and try again."
                ),
            )
        logger.warning("Falling back to bundled sample dataset: %s", exc)
        vacancies = load_sample_vacancies()
        source = "sample"

    created, updated = _upsert(db, vacancies, summarizer)
    closed = _mark_missing_as_closed(db, {v["external_id"] for v in vacancies})
    db.commit()

    message = (
        "Loaded sample data (Careers@Gov was unreachable)."
        if source == "sample"
        else "Vacancies refreshed from Careers@Gov."
    )
    logger.info(
        "Refresh complete: source=%s found=%d created=%d updated=%d closed=%d",
        source,
        len(vacancies),
        created,
        updated,
        closed,
    )
    return RefreshResult(
        ok=True,
        source=source,
        total_found=len(vacancies),
        created=created,
        updated=updated,
        closed=closed,
        message=message,
    )


def _upsert(db: Session, vacancies: List[Dict], summarizer: Summarizer) -> tuple[int, int]:
    created = 0
    updated = 0
    # Determine the next display order for newly added records.
    max_order = db.execute(select(Vacancy.display_order)).scalars().all()
    next_order = (max(max_order) + 1) if max_order else 0

    for rec in vacancies:
        existing = db.execute(
            select(Vacancy).where(Vacancy.external_id == rec["external_id"])
        ).scalar_one_or_none()

        if existing is None:
            summary = summarizer.summarize(
                rec["title"], rec.get("division", ""), rec.get("description", "")
            )
            db.add(
                Vacancy(
                    external_id=rec["external_id"],
                    title=rec["title"],
                    division=rec.get("division", ""),
                    closing_date=rec.get("closing_date", ""),
                    description=rec.get("description", ""),
                    apply_url=rec.get("apply_url", ""),
                    summary=summary,
                    display_order=next_order,
                    is_open=True,
                    last_seen_at=datetime.utcnow(),
                )
            )
            next_order += 1
            created += 1
        else:
            existing.title = rec["title"]
            existing.division = rec.get("division", "")
            existing.closing_date = rec.get("closing_date", "")
            existing.description = rec.get("description", "")
            existing.apply_url = rec.get("apply_url", "")
            existing.is_open = True
            existing.last_seen_at = datetime.utcnow()
            # Do not overwrite an HR-edited summary.
            if not existing.summary_edited:
                existing.summary = summarizer.summarize(
                    rec["title"], rec.get("division", ""), rec.get("description", "")
                )
            updated += 1

    return created, updated


def _mark_missing_as_closed(db: Session, current_ids: set[str]) -> int:
    """Mark previously stored vacancies that are no longer open as closed."""
    closed = 0
    rows = db.execute(select(Vacancy).where(Vacancy.is_open.is_(True))).scalars().all()
    for row in rows:
        if row.external_id not in current_ids:
            row.is_open = False
            row.hidden = True  # Do not include closed roles in the eDM.
            closed += 1
    return closed
