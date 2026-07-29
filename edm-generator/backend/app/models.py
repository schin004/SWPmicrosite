"""SQLAlchemy ORM models."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class Vacancy(Base):
    """A single NParks vacancy retrieved from Careers@Gov.

    ``external_id`` uniquely identifies the vacancy at the source and is used
    to de-duplicate across refreshes so we never show the same role twice.
    """

    __tablename__ = "vacancies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    external_id: Mapped[str] = mapped_column(String(255), unique=True, index=True)

    # Data extracted from the source listing.
    title: Mapped[str] = mapped_column(String(500))
    division: Mapped[str] = mapped_column(String(255), default="")
    closing_date: Mapped[str] = mapped_column(String(100), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    apply_url: Mapped[str] = mapped_column(String(1000), default="")

    # AI-generated (and optionally HR-edited) one-line summary.
    summary: Mapped[str] = mapped_column(Text, default="")
    # True once HR edits the summary, so future refreshes do not overwrite it.
    summary_edited: Mapped[bool] = mapped_column(Boolean, default=False)

    # Admin controls.
    hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0)

    # Bookkeeping.
    is_open: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )
