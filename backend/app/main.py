"""Pro-Vigil FastAPI application entry-point."""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import init_db

logger = logging.getLogger("provigil")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)


# ── Lifespan ──────────────────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown logic."""

    # ── Startup ───────────────────────────────────────────────────────────
    logger.info("Initialising database …")
    init_db()

    # Seed demo data
    try:
        from app.seed_demo import seed_demo_data
        seed_demo_data()
    except Exception:
        logger.exception("Demo seeder failed – continuing.")

    # MQTT service
    try:
        from app.services.mqtt_service import start_mqtt
        start_mqtt()
    except Exception:
        logger.exception("MQTT service failed to start – continuing without it.")

    # Scheduler
    try:
        from app.services.scheduler import start_scheduler
        start_scheduler()
    except Exception:
        logger.exception("Scheduler failed to start – continuing without it.")

    yield

    # ── Shutdown ──────────────────────────────────────────────────────────
    try:
        from app.services.mqtt_service import stop_mqtt
        stop_mqtt()
    except Exception:
        logger.exception("Error stopping MQTT service.")

    try:
        from app.services.scheduler import stop_scheduler
        stop_scheduler()
    except Exception:
        logger.exception("Error stopping scheduler.")


# ── App construction ──────────────────────────────────────────────────────────

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Predictive maintenance API for smart electricity meters.",
    lifespan=lifespan,
)

# CORS – allow all origins during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register routers ─────────────────────────────────────────────────────────

from app.routers import alerts, dashboard, ingest, meters, workorders  # noqa: E402
from app.routers import network, digital_twin, vision, retraining, ai  # noqa: E402

app.include_router(meters.router)
app.include_router(alerts.router)
app.include_router(workorders.router)
app.include_router(dashboard.router)
app.include_router(ingest.router)
app.include_router(network.router)
app.include_router(digital_twin.router)
app.include_router(vision.router)
app.include_router(retraining.router)
app.include_router(ai.router)

# ── Serve front-end build (production) ────────────────────────────────────────

_dashboard_build = os.path.join(os.path.dirname(__file__), "..", "..", "dashboard", "build")
if os.path.isdir(_dashboard_build):
    app.mount("/", StaticFiles(directory=_dashboard_build, html=True), name="dashboard")


# ── Root health-check ─────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "name": "Pro-Vigil API",
        "version": "1.0.0",
        "status": "running",
    }
