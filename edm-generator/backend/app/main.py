"""FastAPI application entry point.

Run locally with:
    uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse

from .config import get_settings
from .database import init_db
from .logging_config import configure_logging, get_logger
from .routers import vacancies
from .services.scheduler import shutdown_scheduler, start_scheduler

settings = get_settings()
configure_logging(settings.log_level)
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialise the database and (optionally) the auto-refresh scheduler."""
    logger.info("Starting %s", settings.app_name)
    init_db()
    start_scheduler()
    try:
        yield
    finally:
        shutdown_scheduler()
        logger.info("Shutting down")


app = FastAPI(
    title=settings.app_name,
    description=(
        "Retrieves open NParks vacancies from Careers@Gov and generates an "
        "Outlook-ready HTML eDM to encourage internal mobility."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(vacancies.router)


@app.get("/api/health")
def health() -> JSONResponse:
    """Simple liveness probe."""
    return JSONResponse({"status": "ok", "app": settings.app_name})


@app.get("/", response_class=HTMLResponse)
def root() -> str:
    """Friendly landing page pointing to the API docs and admin UI."""
    return (
        f"<h1>{settings.app_name}</h1>"
        "<p>Backend is running. "
        "See <a href='/docs'>/docs</a> for the API, and run the frontend "
        "admin app (see README) to manage vacancies and generate the eDM.</p>"
    )
