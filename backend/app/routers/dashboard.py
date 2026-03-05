"""Router for dashboard aggregate endpoints."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.schemas import Alert, Anomaly, Meter
from app.models.pydantic_models import AlertResponse, DashboardStats

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
def dashboard_stats(db: Session = Depends(get_db)):
    """Return high-level system statistics for the dashboard."""
    total = db.query(func.count(Meter.id)).scalar() or 0
    healthy = db.query(func.count(Meter.id)).filter(Meter.status == "healthy").scalar() or 0
    warning = db.query(func.count(Meter.id)).filter(Meter.status == "warning").scalar() or 0
    critical = db.query(func.count(Meter.id)).filter(Meter.status == "critical").scalar() or 0

    twenty_four_hours_ago = datetime.now(timezone.utc) - timedelta(hours=24)
    alerts_24h = (
        db.query(func.count(Alert.id))
        .filter(Alert.created_at >= twenty_four_hours_ago)
        .scalar()
        or 0
    )

    avg_health = db.query(func.avg(Meter.health_score)).scalar()
    avg_health = round(avg_health, 4) if avg_health is not None else 1.0

    return DashboardStats(
        total_meters=total,
        healthy=healthy,
        warning=warning,
        critical=critical,
        total_alerts_24h=alerts_24h,
        avg_health_score=avg_health,
    )


@router.get("/health-distribution")
def health_distribution(db: Session = Depends(get_db)):
    """Return a histogram of meter health scores in 0.1-wide buckets.

    Response example::

        {"buckets": [{"range": "0.0-0.1", "count": 2}, ...]}
    """
    buckets = []
    for i in range(10):
        lo = round(i * 0.1, 1)
        hi = round((i + 1) * 0.1, 1)
        count = (
            db.query(func.count(Meter.id))
            .filter(Meter.health_score >= lo, Meter.health_score < hi)
            .scalar()
            or 0
        )
        # The top bucket should also include exactly 1.0
        if i == 9:
            count = (
                db.query(func.count(Meter.id))
                .filter(Meter.health_score >= lo, Meter.health_score <= hi)
                .scalar()
                or 0
            )
        buckets.append({"range": f"{lo:.1f}-{hi:.1f}", "count": count})
    return {"buckets": buckets}


@router.get("/anomaly-trend")
def anomaly_trend(db: Session = Depends(get_db)):
    """Return daily anomaly counts for the last 30 days, broken down by suspected issue.

    Response example::

        {"days": [{"date": "2026-02-01", "total": 5, "by_issue": {"thermal_stress": 3, ...}}, ...]}
    """
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)

    anomalies = (
        db.query(Anomaly)
        .filter(Anomaly.detected_at >= thirty_days_ago)
        .order_by(Anomaly.detected_at)
        .all()
    )

    # Bucket by calendar date
    day_map: dict[str, dict] = {}
    for a in anomalies:
        day_str = a.detected_at.strftime("%Y-%m-%d") if a.detected_at else "unknown"
        if day_str not in day_map:
            day_map[day_str] = {"date": day_str, "total": 0, "by_issue": {}}
        day_map[day_str]["total"] += 1
        issue = a.suspected_issue or "unknown"
        day_map[day_str]["by_issue"][issue] = day_map[day_str]["by_issue"].get(issue, 0) + 1

    # Ensure all 30 days are present even if they have zero anomalies
    days_result = []
    for offset in range(30):
        target = (datetime.now(timezone.utc) - timedelta(days=29 - offset)).strftime("%Y-%m-%d")
        if target in day_map:
            days_result.append(day_map[target])
        else:
            days_result.append({"date": target, "total": 0, "by_issue": {}})

    return {"days": days_result}


@router.get("/recent-alerts", response_model=list[AlertResponse])
def recent_alerts(db: Session = Depends(get_db)):
    """Return the 20 most recent alerts."""
    alerts = db.query(Alert).order_by(Alert.created_at.desc()).limit(20).all()
    return [AlertResponse.model_validate(a) for a in alerts]
