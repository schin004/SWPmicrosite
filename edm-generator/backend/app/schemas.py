"""Pydantic request/response schemas."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class VacancyBase(BaseModel):
    title: str
    division: str = ""
    closing_date: str = ""
    apply_url: str = ""
    summary: str = ""


class VacancyRead(VacancyBase):
    """Full vacancy as returned to the admin UI."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    external_id: str
    description: str = ""
    summary_edited: bool = False
    hidden: bool = False
    display_order: int = 0
    is_open: bool = True
    updated_at: Optional[datetime] = None


class VacancyUpdate(BaseModel):
    """Editable fields on a vacancy. All optional (partial update)."""

    summary: Optional[str] = None
    hidden: Optional[bool] = None
    title: Optional[str] = None
    division: Optional[str] = None
    closing_date: Optional[str] = None


class ReorderRequest(BaseModel):
    """Ordered list of vacancy ids representing the desired display order."""

    ordered_ids: List[int] = Field(..., description="Vacancy ids in display order.")


class RefreshResult(BaseModel):
    ok: bool
    source: str = Field(description="'live' or 'sample'.")
    total_found: int
    created: int
    updated: int
    closed: int
    message: str = ""


class EdmResponse(BaseModel):
    html: str
    vacancy_count: int


class ConfigResponse(BaseModel):
    app_name: str
    careers_agency: str
    auto_refresh_enabled: bool
    auto_refresh_interval: str
    ai_summaries_enabled: bool
    total_vacancies: int
    visible_vacancies: int
