"""Router for meter endpoints."""

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.schemas import Anomaly, Meter, Reading
from app.models.pydantic_models import (
    AnomalyResponse,
    HealthScoreResponse,
    MeterListResponse,
    MeterResponse,
    ReadingResponse,
)

router = APIRouter(prefix="/api/meters", tags=["meters"])


@router.get("/", response_model=MeterListResponse)
def list_meters(
    status: Optional[str] = Query(None, description="Filter by status: healthy, warning, critical"),
    db: Session = Depends(get_db),
):
    """Return all meters, optionally filtered by status."""
    query = db.query(Meter)
    if status:
        query = query.filter(Meter.status == status)
    meters = query.order_by(Meter.name).all()
    return MeterListResponse(
        meters=[MeterResponse.model_validate(m) for m in meters],
        total=len(meters),
    )


@router.get("/{meter_id}", response_model=MeterResponse)
def get_meter(meter_id: str, db: Session = Depends(get_db)):
    """Return a single meter by ID."""
    meter = db.query(Meter).filter(Meter.id == meter_id).first()
    if not meter:
        raise HTTPException(status_code=404, detail="Meter not found")
    return MeterResponse.model_validate(meter)


@router.get("/{meter_id}/readings", response_model=list[ReadingResponse])
def get_meter_readings(
    meter_id: str,
    start: Optional[datetime] = Query(None, description="Start of time range (ISO 8601)"),
    end: Optional[datetime] = Query(None, description="End of time range (ISO 8601)"),
    limit: int = Query(100, ge=1, le=5000),
    db: Session = Depends(get_db),
):
    """Return readings for a meter within an optional time window."""
    meter = db.query(Meter).filter(Meter.id == meter_id).first()
    if not meter:
        raise HTTPException(status_code=404, detail="Meter not found")

    query = db.query(Reading).filter(Reading.meter_id == meter_id)
    if start:
        query = query.filter(Reading.timestamp >= start)
    if end:
        query = query.filter(Reading.timestamp <= end)
    readings = query.order_by(desc(Reading.timestamp)).limit(limit).all()
    return [ReadingResponse.model_validate(r) for r in readings]


@router.get("/{meter_id}/anomalies", response_model=list[AnomalyResponse])
def get_meter_anomalies(
    meter_id: str,
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """Return anomaly records for a meter."""
    meter = db.query(Meter).filter(Meter.id == meter_id).first()
    if not meter:
        raise HTTPException(status_code=404, detail="Meter not found")

    anomalies = (
        db.query(Anomaly)
        .filter(Anomaly.meter_id == meter_id)
        .order_by(desc(Anomaly.detected_at))
        .limit(limit)
        .all()
    )
    results = []
    for a in anomalies:
        resp = AnomalyResponse.model_validate(a)
        resp.contributing_factors = a.get_contributing_factors()
        results.append(resp)
    return results


@router.get("/{meter_id}/health", response_model=HealthScoreResponse)
def get_meter_health(
    meter_id: str,
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    """Return the current health score and recent history for a meter."""
    meter = db.query(Meter).filter(Meter.id == meter_id).first()
    if not meter:
        raise HTTPException(status_code=404, detail="Meter not found")

    # Build history from anomaly scores (most recent first).
    anomalies = (
        db.query(Anomaly)
        .filter(Anomaly.meter_id == meter_id)
        .order_by(desc(Anomaly.detected_at))
        .limit(limit)
        .all()
    )
    history = [
        {
            "timestamp": a.detected_at.isoformat() if a.detected_at else None,
            "score": round(1.0 - a.anomaly_score, 4),
        }
        for a in anomalies
    ]
    return HealthScoreResponse(
        meter_id=meter.id,
        current_score=meter.health_score,
        status=meter.status,
        history=history,
    )


@router.get("/{meter_id}/forecast")
def get_meter_forecast(
    meter_id: str,
    days: int = Query(7, ge=1, le=30),
    db: Session = Depends(get_db),
):
    """Predict health score over the next N days using linear extrapolation."""
    meter = db.query(Meter).filter(Meter.id == meter_id).first()
    if not meter:
        raise HTTPException(status_code=404, detail="Meter not found")

    # Get recent anomaly scores to establish a trend
    anomalies = (
        db.query(Anomaly)
        .filter(Anomaly.meter_id == meter_id)
        .order_by(desc(Anomaly.detected_at))
        .limit(20)
        .all()
    )

    # Compute trend from recent health scores
    health_points = [1.0 - a.anomaly_score for a in reversed(anomalies)] if anomalies else [meter.health_score]

    if len(health_points) >= 2:
        # Simple linear regression on the last N points
        n = len(health_points)
        x_mean = (n - 1) / 2.0
        y_mean = sum(health_points) / n
        numerator = sum((i - x_mean) * (y - y_mean) for i, y in enumerate(health_points))
        denominator = sum((i - x_mean) ** 2 for i in range(n))
        slope = numerator / denominator if denominator != 0 else 0
    else:
        slope = -0.005  # default slight decline

    now = datetime.now(timezone.utc)
    forecast = []
    for d in range(1, days + 1):
        projected = max(0.0, min(1.0, meter.health_score + slope * d * 2))
        forecast.append({
            "date": (now + timedelta(days=d)).strftime("%Y-%m-%d"),
            "predicted_health": round(projected, 4),
            "confidence_lower": round(max(0, projected - 0.05 * d), 4),
            "confidence_upper": round(min(1, projected + 0.03 * d), 4),
        })

    days_to_critical = None
    if slope < 0:
        projected_daily_decline = abs(slope * 2)
        if projected_daily_decline > 0 and meter.health_score > 0.35:
            days_to_critical = max(0, int((meter.health_score - 0.35) / projected_daily_decline))

    legacy_forecasts = [
        {
            "day": index + 1,
            "date": item["date"],
            "predicted_health": item["predicted_health"],
            "upper_bound": item["confidence_upper"],
            "lower_bound": item["confidence_lower"],
        }
        for index, item in enumerate(forecast)
    ]

    return {
        "meter_id": meter.id,
        "current_health": meter.health_score,
        "trend_slope": round(slope, 6),
        "trend_direction": "declining" if slope < -0.001 else "stable" if abs(slope) <= 0.001 else "improving",
        "forecast": forecast,
        "forecasts": legacy_forecasts,
        "trend": "declining" if slope < -0.001 else "stable" if abs(slope) <= 0.001 else "improving",
        "days_to_critical": days_to_critical,
    }


@router.get("/{meter_id}/remaining-life")
def get_remaining_life(meter_id: str, db: Session = Depends(get_db)):
    """Estimate remaining useful life based on health decay rate."""
    meter = db.query(Meter).filter(Meter.id == meter_id).first()
    if not meter:
        raise HTTPException(status_code=404, detail="Meter not found")

    health = meter.health_score

    # Simple decay model: how many days until health reaches critical (0.35)?
    anomalies = (
        db.query(Anomaly)
        .filter(Anomaly.meter_id == meter_id)
        .order_by(desc(Anomaly.detected_at))
        .limit(10)
        .all()
    )

    if len(anomalies) >= 2:
        scores = [1.0 - a.anomaly_score for a in reversed(anomalies)]
        daily_decline = (scores[0] - scores[-1]) / max(len(scores), 1)
    else:
        daily_decline = 0.002  # default

    if daily_decline > 0 and health > 0.35:
        days_remaining = int((health - 0.35) / daily_decline)
    elif health <= 0.35:
        days_remaining = 0
    else:
        days_remaining = 365  # stable, long life

    # Battery life estimate
    install_age_days = (datetime.now(timezone.utc) - meter.install_date).days if meter.install_date else 365
    battery_months_total = 96  # 8-year typical battery life
    battery_months_used = install_age_days / 30.44
    battery_months_remaining = max(0, battery_months_total - battery_months_used)

    days_remaining_capped = max(0, min(days_remaining, 1825))
    months_remaining_capped = days_remaining_capped // 30
    battery_health_pct = round(max(0, battery_months_remaining / battery_months_total * 100), 1)

    return {
        "meter_id": meter.id,
        "current_health": health,
        "estimated_days_remaining": days_remaining_capped,  # cap at 5 years
        "estimated_months_remaining": months_remaining_capped,
        "risk_category": "immediate" if days_remaining < 7 else "short_term" if days_remaining < 30 else "medium_term" if days_remaining < 180 else "long_term",
        "battery": {
            "estimated_months_remaining": round(battery_months_remaining, 1),
            "battery_health_pct": battery_health_pct,
        },
        "daily_health_decline_rate": round(daily_decline, 5),
        "remaining_days": days_remaining_capped,
        "remaining_years": round(days_remaining_capped / 365, 1),
        "battery_health": round(battery_health_pct / 100, 4),
        "decay_rate_per_day": round(daily_decline, 5),
    }
