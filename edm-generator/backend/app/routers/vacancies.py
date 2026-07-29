"""Vacancy + eDM API endpoints."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..logging_config import get_logger
from ..models import Vacancy
from ..schemas import (
    ConfigResponse,
    EdmResponse,
    RefreshResult,
    ReorderRequest,
    VacancyRead,
    VacancyUpdate,
)
from ..services.edm import build_edm_html
from ..services.refresh import refresh_vacancies
from ..services.summarizer import Summarizer

logger = get_logger(__name__)
router = APIRouter(prefix="/api", tags=["vacancies"])


def _ordered_query():
    return select(Vacancy).order_by(Vacancy.display_order.asc(), Vacancy.id.asc())


@router.get("/config", response_model=ConfigResponse)
def get_config(db: Session = Depends(get_db)) -> ConfigResponse:
    """Return runtime configuration and vacancy counts for the admin UI."""
    settings = get_settings()
    total = db.execute(select(func.count(Vacancy.id))).scalar_one()
    visible = db.execute(
        select(func.count(Vacancy.id)).where(Vacancy.hidden.is_(False))
    ).scalar_one()
    return ConfigResponse(
        app_name=settings.app_name,
        careers_agency=settings.careers_agency,
        auto_refresh_enabled=settings.auto_refresh_enabled,
        auto_refresh_interval=settings.auto_refresh_interval,
        ai_summaries_enabled=Summarizer(settings).ai_enabled,
        total_vacancies=total,
        visible_vacancies=visible,
    )


@router.get("/vacancies", response_model=List[VacancyRead])
def list_vacancies(db: Session = Depends(get_db)) -> List[Vacancy]:
    """List all vacancies (including hidden) in display order for the admin."""
    return list(db.execute(_ordered_query()).scalars().all())


@router.post("/vacancies/refresh", response_model=RefreshResult)
def refresh(db: Session = Depends(get_db)) -> RefreshResult:
    """Retrieve current open vacancies from Careers@Gov and store them."""
    try:
        return refresh_vacancies(db)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Refresh endpoint failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Refresh failed: {exc}",
        ) from exc


@router.patch("/vacancies/{vacancy_id}", response_model=VacancyRead)
def update_vacancy(
    vacancy_id: int, payload: VacancyUpdate, db: Session = Depends(get_db)
) -> Vacancy:
    """Edit a vacancy's summary, visibility or core fields."""
    vacancy = db.get(Vacancy, vacancy_id)
    if vacancy is None:
        raise HTTPException(status_code=404, detail="Vacancy not found")

    data = payload.model_dump(exclude_unset=True)
    if "summary" in data and data["summary"] is not None:
        vacancy.summary = data["summary"]
        vacancy.summary_edited = True  # Protect from future refresh overwrites.
    for field in ("hidden", "title", "division", "closing_date"):
        if field in data and data[field] is not None:
            setattr(vacancy, field, data[field])

    db.commit()
    db.refresh(vacancy)
    return vacancy


@router.post("/vacancies/reorder", response_model=List[VacancyRead])
def reorder_vacancies(
    payload: ReorderRequest, db: Session = Depends(get_db)
) -> List[Vacancy]:
    """Set the display order from an ordered list of vacancy ids."""
    for index, vacancy_id in enumerate(payload.ordered_ids):
        vacancy = db.get(Vacancy, vacancy_id)
        if vacancy is not None:
            vacancy.display_order = index
    db.commit()
    return list(db.execute(_ordered_query()).scalars().all())


@router.get("/edm", response_model=EdmResponse)
def generate_edm(db: Session = Depends(get_db)) -> EdmResponse:
    """Generate the Outlook-ready eDM HTML for all visible vacancies."""
    visible = list(
        db.execute(
            _ordered_query().where(Vacancy.hidden.is_(False))
        ).scalars().all()
    )
    html = build_edm_html(
        {
            "title": v.title,
            "division": v.division,
            "closing_date": v.closing_date,
            "summary": v.summary,
            "apply_url": v.apply_url,
        }
        for v in visible
    )
    return EdmResponse(html=html, vacancy_count=len(visible))
