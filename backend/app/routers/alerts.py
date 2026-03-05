"""Router for alert endpoints."""

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.schemas import Alert
from app.models.pydantic_models import AlertAcknowledge, AlertResponse

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("/stats")
def alert_stats(db: Session = Depends(get_db)):
    """Return aggregate alert statistics.

    Counts by severity and by alert_type for the last 7 days.
    """
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)

    severity_rows = (
        db.query(Alert.severity, func.count(Alert.id))
        .filter(Alert.created_at >= seven_days_ago)
        .group_by(Alert.severity)
        .all()
    )
    by_severity = {sev: cnt for sev, cnt in severity_rows}

    type_rows = (
        db.query(Alert.alert_type, func.count(Alert.id))
        .filter(Alert.created_at >= seven_days_ago)
        .group_by(Alert.alert_type)
        .all()
    )
    by_type = {atype: cnt for atype, cnt in type_rows}

    total_unacknowledged = (
        db.query(func.count(Alert.id))
        .filter(Alert.acknowledged == False)  # noqa: E712
        .scalar()
    )

    return {
        "by_severity": by_severity,
        "by_type": by_type,
        "total_unacknowledged": total_unacknowledged,
        "period_days": 7,
    }


@router.get("/", response_model=list[AlertResponse])
def list_alerts(
    severity: Optional[str] = Query(None, description="Filter by severity: info, warning, critical"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """Return alerts with optional severity filter and pagination."""
    query = db.query(Alert)
    if severity:
        query = query.filter(Alert.severity == severity)
    alerts = query.order_by(desc(Alert.created_at)).offset(skip).limit(limit).all()
    return [AlertResponse.model_validate(a) for a in alerts]


@router.put("/{alert_id}/acknowledge", response_model=AlertResponse)
def acknowledge_alert(
    alert_id: int,
    body: AlertAcknowledge,
    db: Session = Depends(get_db),
):
    """Acknowledge (or un-acknowledge) an alert."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.acknowledged = body.acknowledged
    db.commit()
    db.refresh(alert)
    return AlertResponse.model_validate(alert)
