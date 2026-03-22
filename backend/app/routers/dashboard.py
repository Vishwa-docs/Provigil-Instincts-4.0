"""Router for dashboard aggregate endpoints."""

import random
import re
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.schemas import Alert, Anomaly, Meter, Reading, Subscriber, WorkOrder
from app.models.pydantic_models import (
    AlertResponse,
    DashboardStats,
    ScenarioTriggerResponse,
    SubscriberCreate,
    SubscriberResponse,
)

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


# ── Fault scenario trigger ────────────────────────────────────────────────────


@router.post("/trigger-scenario", response_model=ScenarioTriggerResponse, status_code=201)
def trigger_scenario(db: Session = Depends(get_db)):
    """Inject a controlled fault cascade to validate the full detection pipeline.

    1. Pick a healthy meter (or first available)
    2. Inject degraded telemetry readings
    3. Create anomaly, alert, and work order records
    4. Return IDs so the UI can navigate to them
    """
    # Pick a meter — prefer one that's currently healthy for dramatic effect
    meter = db.query(Meter).filter(Meter.status == "healthy").first()
    if not meter:
        meter = db.query(Meter).first()
    if not meter:
        raise HTTPException(status_code=404, detail="No meters available")

    now = datetime.now(timezone.utc)

    # Inject 10 degraded readings (progressive failure pattern)
    for i in range(10):
        progress = i / 9.0
        reading = Reading(
            meter_id=meter.id,
            timestamp=now - timedelta(minutes=30 * (9 - i)),
            voltage=220.0 - 18.0 * progress + random.uniform(-2, 2),
            current=8.0 + random.uniform(0, 3),
            power=1800.0 + random.uniform(-200, 200),
            energy_import=random.uniform(0.01, 0.05),
            temperature=42.0 + 20.0 * progress + random.uniform(-2, 2),
            frequency=49.8 + random.uniform(-0.3, 0.3),
            power_factor=0.92 - 0.15 * progress,
            thd=3.0 + 7.0 * progress + random.uniform(-0.5, 0.5),
            relay_chatter_ms=5.0 + 175.0 * progress + random.uniform(-10, 10),
            battery_voltage=3.1 - 0.7 * progress,
            harmonic_distortion=0.02 + 0.3 * progress,
            firmware_heap_pct=40.0 + 50.0 * progress,
            voc_ppm=8.0 + 120.0 * progress + random.uniform(-5, 5),
            local_alert=progress > 0.5,
        )
        db.add(reading)

    # Update meter status
    meter.health_score = 0.22
    meter.status = "critical"
    meter.suspected_issue = "Thermal Stress — Loose Terminal"
    meter.last_seen = now
    meter.updated_at = now

    # Create anomaly
    anomaly = Anomaly(
        meter_id=meter.id,
        detected_at=now,
        anomaly_score=0.78,
        risk_level="critical",
        suspected_issue="Thermal Stress — Loose Terminal",
    )
    anomaly.set_contributing_factors([
        "Thermal Stress — Loose Terminal: High temperature (62.1°C) with normal load (8.5A) indicates contact resistance buildup (score=0.47)",
        "Harmonic / THD Damage: THD 9.8% exceeds India CEA 5% legal limit — power supply stress (score=0.31)",
        "Relay Chatter — Contact Wear: Relay bounce duration 178ms exceeds 50ms threshold — mechanical contact degradation (score=0.30)",
        "Battery Discharge Critical: Battery voltage 2.42V below 2.8V threshold — end-of-life approaching (score=0.25)",
        "Arcing Gas Detected — VOC Sensor: VOC level 128 ppm exceeds 50 ppm safe threshold — possible arcing (score=0.22)",
    ])
    db.add(anomaly)

    # Create alert
    alert = Alert(
        meter_id=meter.id,
        alert_type="anomaly",
        severity="critical",
        message=(
            f"ALERT — Multiple fault signatures detected on {meter.name}: "
            f"thermal stress (62°C with I²R heating), relay chatter (178ms), "
            f"THD 9.8% (exceeds CEA 5% limit), battery 2.4V, VOC gas 128 ppm. "
            f"Immediate inspection required."
        ),
    )
    db.add(alert)
    db.flush()  # get alert.id

    # Create work order
    wo = WorkOrder(
        meter_id=meter.id,
        priority=1,
        status="pending",
        issue_type="Thermal Stress — Loose Terminal",
        description=(
            f"URGENT: Multiple concurrent fault indicators detected on {meter.name} ({meter.id}).\n\n"
            f"Findings:\n"
            f"• Terminal temperature: 62°C (threshold: 48°C) — I²R heating indicates loose screw connection\n"
            f"• VOC gas level: 128 ppm (threshold: 50 ppm) — arcing / off-gassing confirms thermal damage\n"
            f"• Relay chatter: 178ms (threshold: 50ms) — contact degradation from repeated load switching\n"
            f"• THD: 9.8% (India CEA limit: 5%) — power supply under harmonic stress\n"
            f"• Battery: 2.4V (threshold: 2.8V) — RTC battery near end-of-life\n"
            f"• Firmware heap: 90% — memory pressure detected\n\n"
            f"Recommended Actions:\n"
            f"1. Dispatch field crew for terminal inspection and torque check\n"
            f"2. Thermal imaging of connection points\n"
            f"3. Test relay with controlled switching sequence\n"
            f"4. Replace RTC battery (CR2450)\n"
            f"5. Schedule firmware update\n"
            f"6. Consider meter swap if THD source persists"
        ),
        scheduled_date=now + timedelta(days=1),
    )
    db.add(wo)
    db.flush()

    db.commit()

    return ScenarioTriggerResponse(
        meter_id=meter.id,
        alert_id=alert.id,
        work_order_id=wo.id,
        message=f"ML detection pipeline triggered for {meter.name}",
        detection_method="Multi-parameter ML anomaly detection identified progressive degradation across 10 readings over 4.5 hours. Six concurrent fault signatures detected with cross-parameter correlation.",
        parameters_changed=[
            {"parameter": "Temperature", "from_val": "42°C", "to_val": "62°C",
             "significance": "I²R heating at terminal indicates loose screw connection — contact resistance converts electrical energy to heat under normal load"},
            {"parameter": "VOC Gas Level", "from_val": "8 ppm", "to_val": "128 ppm",
             "significance": "Volatile organic compounds from arcing / thermal decomposition of insulation — secondary confirmation of loose terminal"},
            {"parameter": "THD", "from_val": "3%", "to_val": "9.8%",
             "significance": "Exceeds India CEA 5% legal limit — harmonic pollution stressing meter power supply components"},
            {"parameter": "Relay Chatter", "from_val": "5ms", "to_val": "178ms",
             "significance": "Mechanical contact wear from repeated heavy inductive load switching — indicates relay degradation"},
            {"parameter": "Battery Voltage", "from_val": "3.1V", "to_val": "2.4V",
             "significance": "RTC backup battery approaching end-of-life — meter will lose timestamping during power outages"},
            {"parameter": "Power Factor", "from_val": "0.92", "to_val": "0.77",
             "significance": "Reactive power imbalance increasing — correlated with harmonic distortion"},
        ],
    )


# ── Subscriber endpoints ─────────────────────────────────────────────────────


_EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")


@router.post("/subscribe", response_model=SubscriberResponse, status_code=201)
def subscribe(body: SubscriberCreate, db: Session = Depends(get_db)):
    """Subscribe an email for critical alert notifications."""
    email = body.email.strip().lower()
    if not _EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Invalid email address")

    existing = db.query(Subscriber).filter(Subscriber.email == email).first()
    if existing:
        if existing.is_active:
            return SubscriberResponse.model_validate(existing)
        existing.is_active = True
        existing.subscribed_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(existing)
        return SubscriberResponse.model_validate(existing)

    sub = Subscriber(email=email)
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return SubscriberResponse.model_validate(sub)


@router.get("/subscribers", response_model=list[SubscriberResponse])
def list_subscribers(db: Session = Depends(get_db)):
    """Return all active subscribers."""
    subs = db.query(Subscriber).filter(Subscriber.is_active == True).all()
    return [SubscriberResponse.model_validate(s) for s in subs]


@router.post("/unsubscribe")
def unsubscribe(body: SubscriberCreate, db: Session = Depends(get_db)):
    """Unsubscribe an email from alert notifications."""
    email = body.email.strip().lower()
    if not _EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Invalid email address")

    existing = db.query(Subscriber).filter(Subscriber.email == email).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Email not found in subscriber list")
    if not existing.is_active:
        return {"detail": "Already unsubscribed"}

    existing.is_active = False
    db.commit()
    return {"detail": "Successfully unsubscribed"}


# ── Email toggle ──────────────────────────────────────────────────────────────


class EmailStatusResponse(BaseModel):
    enabled: bool


class EmailToggleRequest(BaseModel):
    enabled: bool


@router.get("/email-status", response_model=EmailStatusResponse)
def email_status():
    """Return whether email notifications are currently enabled."""
    from app.services.email_service import is_email_enabled
    return EmailStatusResponse(enabled=is_email_enabled())


@router.post("/email-toggle", response_model=EmailStatusResponse)
def email_toggle(body: EmailToggleRequest):
    """Enable or disable email notifications at runtime."""
    from app.services.email_service import set_email_enabled
    set_email_enabled(body.enabled)
    return EmailStatusResponse(enabled=body.enabled)
