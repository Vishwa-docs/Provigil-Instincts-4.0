"""Router for AI-powered summarization and work order generation."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.schemas import Alert, Meter, Reading, WorkOrder
from app.services.llm_service import summarize_anomaly, generate_work_order_description

router = APIRouter(prefix="/api/ai", tags=["ai"])


class SummarizeRequest(BaseModel):
    meter_id: str
    alert_id: Optional[int] = None


class GenerateWorkOrderRequest(BaseModel):
    alert_id: int


@router.post("/summarize")
def summarize(req: SummarizeRequest, db: Session = Depends(get_db)):
    """Generate an LLM-powered summary for a meter's current anomaly."""
    meter = db.query(Meter).filter(Meter.id == req.meter_id).first()
    if not meter:
        raise HTTPException(status_code=404, detail="Meter not found")

    # Get latest reading
    latest_reading = (
        db.query(Reading)
        .filter(Reading.meter_id == req.meter_id)
        .order_by(Reading.timestamp.desc())
        .first()
    )

    meter_data = {
        "id": meter.id,
        "name": meter.name,
        "health_score": meter.health_score,
        "status": meter.status,
        "location_lat": meter.location_lat or 0,
        "location_lng": meter.location_lng or 0,
        "voltage": latest_reading.voltage if latest_reading else None,
        "current": latest_reading.current if latest_reading else None,
        "temperature": latest_reading.temperature if latest_reading else None,
        "power_factor": latest_reading.power_factor if latest_reading else None,
    }

    anomaly_data = {
        "suspected_issue": meter.suspected_issue or "unknown",
        "risk_level": meter.status,
        "contributing_factors": [],
    }

    if req.alert_id:
        alert = db.query(Alert).filter(Alert.id == req.alert_id).first()
        if alert:
            anomaly_data["message"] = alert.message
            anomaly_data["alert_type"] = alert.alert_type

    summary = summarize_anomaly(meter_data, anomaly_data)
    return {"meter_id": meter.id, "summary": summary}


@router.post("/generate-workorder")
def generate_workorder(req: GenerateWorkOrderRequest, db: Session = Depends(get_db)):
    """Auto-generate a work order from an alert using LLM."""
    alert = db.query(Alert).filter(Alert.id == req.alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    meter = db.query(Meter).filter(Meter.id == alert.meter_id).first()
    if not meter:
        raise HTTPException(status_code=404, detail="Meter not found")

    alert_data = {
        "message": alert.message,
        "severity": alert.severity,
        "alert_type": alert.alert_type,
        "suspected_issue": meter.suspected_issue or alert.alert_type,
    }
    meter_data = {
        "id": meter.id,
        "name": meter.name,
        "health_score": meter.health_score,
        "location_lat": meter.location_lat or 0,
        "location_lng": meter.location_lng or 0,
    }

    wo_data = generate_work_order_description(alert_data, meter_data)

    work_order = WorkOrder(
        meter_id=meter.id,
        priority=wo_data["priority"],
        issue_type=wo_data["issue_type"],
        description=wo_data["description"],
        status="pending",
    )
    db.add(work_order)
    db.commit()
    db.refresh(work_order)

    return {
        "work_order_id": work_order.id,
        "meter_id": meter.id,
        "title": work_order.issue_type,
        "priority": work_order.priority,
        "issue_type": work_order.issue_type,
        "description": work_order.description,
        "status": work_order.status,
        "estimated_duration": wo_data.get("estimated_duration"),
    }
