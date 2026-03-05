"""APScheduler configuration for periodic scoring cycles."""

import logging

from apscheduler.schedulers.background import BackgroundScheduler

from app.config import settings

logger = logging.getLogger(__name__)

_scheduler: BackgroundScheduler | None = None


def start_scheduler() -> None:
    """Create and start the background scheduler.

    A single job is registered that calls :func:`run_scoring_cycle` at the
    interval defined by ``SCORING_INTERVAL_SECONDS``.
    """
    global _scheduler

    from app.services.scoring_service import run_scoring_cycle

    _scheduler = BackgroundScheduler(daemon=True)
    _scheduler.add_job(
        run_scoring_cycle,
        trigger="interval",
        seconds=settings.SCORING_INTERVAL_SECONDS,
        id="scoring_cycle",
        name="Periodic anomaly scoring",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    _scheduler.start()
    logger.info(
        "Scheduler started – scoring cycle every %d s.",
        settings.SCORING_INTERVAL_SECONDS,
    )


def stop_scheduler() -> None:
    """Shut down the scheduler gracefully."""
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped.")
        _scheduler = None
