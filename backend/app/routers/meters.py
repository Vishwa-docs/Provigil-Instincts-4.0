"""Router for meter endpoints."""

from datetime import datetime
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
