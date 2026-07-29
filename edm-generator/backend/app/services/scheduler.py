"""Optional scheduled auto-refresh.

Refresh is on demand by default. When ``AUTO_REFRESH_ENABLED`` is true, a
background scheduler triggers :func:`refresh_vacancies` on the configured
interval (hourly / daily / weekly). This is purely optional and administrator
configurable — the tool works fully without it.
"""

from __future__ import annotations

from typing import Optional

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from ..config import get_settings
from ..database import session_scope
from ..logging_config import get_logger
from .refresh import refresh_vacancies

logger = get_logger(__name__)

_scheduler: Optional[BackgroundScheduler] = None

_INTERVAL_TRIGGERS = {
    "hourly": {"minute": 0},
    "daily": {"hour": 3, "minute": 0},          # 03:00 server time
    "weekly": {"day_of_week": "mon", "hour": 3, "minute": 0},
}


def _run_refresh() -> None:
    """Scheduler job wrapper with its own DB session and error isolation."""
    logger.info("Scheduled refresh triggered")
    try:
        with session_scope() as db:
            refresh_vacancies(db)
    except Exception as exc:  # noqa: BLE001 - never let a job crash the scheduler
        logger.exception("Scheduled refresh failed: %s", exc)


def start_scheduler() -> Optional[BackgroundScheduler]:
    """Start the scheduler if auto-refresh is enabled. Returns the scheduler."""
    global _scheduler
    settings = get_settings()
    if not settings.auto_refresh_enabled:
        logger.info("Auto-refresh disabled; vacancies refresh on demand only.")
        return None

    trigger_kwargs = _INTERVAL_TRIGGERS.get(
        settings.auto_refresh_interval, _INTERVAL_TRIGGERS["daily"]
    )
    _scheduler = BackgroundScheduler(daemon=True)
    _scheduler.add_job(
        _run_refresh,
        trigger=CronTrigger(**trigger_kwargs),
        id="refresh_vacancies",
        replace_existing=True,
    )
    _scheduler.start()
    logger.info(
        "Auto-refresh enabled: interval=%s (%s)",
        settings.auto_refresh_interval,
        trigger_kwargs,
    )
    return _scheduler


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
