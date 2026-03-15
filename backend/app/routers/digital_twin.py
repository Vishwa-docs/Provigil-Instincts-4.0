"""Router for digital twin endpoints."""

import random
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.schemas import Meter, Reading

router = APIRouter(prefix="/api/digital-twin", tags=["digital-twin"])


def _derive_component_health(meter, readings) -> dict:
    """Derive per-component health from telemetry data."""
    components = {}

    # Defaults
    latest = readings[0] if readings else None

    # Terminal Connections (L1, L2, L3, Neutral)
    temp = latest.temperature if latest else 32.0
    voltage = latest.voltage if latest else 230.0
    temp_risk = max(0, min(1, (temp - 35) / 40)) if temp else 0
    voltage_risk = max(0, min(1, abs(voltage - 230) / 50)) if voltage else 0

    terminal_score = max(0, 1.0 - max(temp_risk, voltage_risk))
    components["terminals"] = {
        "name": "Terminal Connections",
        "status": "critical" if terminal_score < 0.4 else "warning" if terminal_score < 0.7 else "ok",
        "health_score": round(terminal_score, 3),
        "temperature": round(temp, 1) if temp else None,
        "details": {
            "L1_phase": {"status": "warning" if voltage_risk > 0.3 else "ok", "voltage": round(voltage, 1) if voltage else None},
            "L2_phase": {"status": "ok", "voltage": round(voltage * random.uniform(0.99, 1.01), 1) if voltage else None},
            "L3_phase": {"status": "ok", "voltage": round(voltage * random.uniform(0.99, 1.01), 1) if voltage else None},
            "neutral": {"status": "ok", "voltage": 0.0},
        },
        "risk_factors": ["Elevated temperature" if temp_risk > 0.3 else None, "Voltage deviation" if voltage_risk > 0.3 else None],
    }
    components["terminals"]["risk_factors"] = [r for r in components["terminals"]["risk_factors"] if r]

    # Power Supply Unit
    pf = latest.power_factor if latest else 0.95
    psu_score = max(0, min(1, pf)) if pf else 0.95
    components["power_supply"] = {
        "name": "Power Supply Unit",
        "status": "warning" if psu_score < 0.85 else "ok",
        "health_score": round(psu_score, 3),
        "details": {"input_voltage": round(voltage, 1) if voltage else 230.0, "power_factor": round(pf, 3) if pf else 0.95},
        "risk_factors": ["Low power factor — PSU stress" if pf and pf < 0.85 else None],
    }
    components["power_supply"]["risk_factors"] = [r for r in components["power_supply"]["risk_factors"] if r]

    # Display Module
    display_score = 0.95 if meter.status != "critical" else 0.6
    components["display"] = {
        "name": "Display Module",
        "status": "ok" if display_score > 0.8 else "warning",
        "health_score": round(display_score, 3),
        "details": {"firmware_version": "v3.2.1", "last_refresh": "OK"},
        "risk_factors": [],
    }

    # Battery / RTC
    install_months = 24  # assume 2-year old meter
    battery_pct = max(0, 100 - (install_months * 0.8) - (max(0, (temp or 30) - 35) * 0.5))
    battery_score = battery_pct / 100.0
    components["battery"] = {
        "name": "Battery & RTC",
        "status": "critical" if battery_score < 0.3 else "warning" if battery_score < 0.6 else "ok",
        "health_score": round(battery_score, 3),
        "details": {
            "battery_level": f"{battery_pct:.0f}%",
            "estimated_months_remaining": round(battery_pct / 0.8, 0),
            "rtc_drift": "< 1 sec/day",
        },
        "risk_factors": ["Battery below 30%" if battery_pct < 30 else None],
    }
    components["battery"]["risk_factors"] = [r for r in components["battery"]["risk_factors"] if r]

    # Relay Module
    current = latest.current if latest else 5.0
    relay_stress = max(0, min(1, (current - 30) / 20)) if current else 0
    relay_score = max(0, 1.0 - relay_stress)
    components["relay"] = {
        "name": "Latching Relay",
        "status": "warning" if relay_score < 0.7 else "ok",
        "health_score": round(relay_score, 3),
        "details": {"current_load": f"{current:.1f}A" if current else "N/A", "cycle_count": random.randint(50, 200)},
        "risk_factors": ["High current load stress" if relay_stress > 0.3 else None],
    }
    components["relay"]["risk_factors"] = [r for r in components["relay"]["risk_factors"] if r]

    # Communication Module
    comm_score = 0.95 if meter.last_seen else 0.3
    components["communication"] = {
        "name": "Communication Module",
        "status": "ok" if comm_score > 0.8 else "warning" if comm_score > 0.5 else "critical",
        "health_score": round(comm_score, 3),
        "details": {"protocol": "RF Mesh + LTE-M", "signal_strength": f"-{random.randint(55, 75)} dBm", "packet_loss": f"{random.uniform(0, 2):.1f}%"},
        "risk_factors": ["No recent communication" if not meter.last_seen else None],
    }
    components["communication"]["risk_factors"] = [r for r in components["communication"]["risk_factors"] if r]

    return components


@router.get("/{meter_id}")
def get_digital_twin(meter_id: str, db: Session = Depends(get_db)):
    """Return per-component health breakdown for a meter's digital twin."""
    meter = db.query(Meter).filter(Meter.id == meter_id).first()
    if not meter:
        raise HTTPException(status_code=404, detail="Meter not found")

    readings = (
        db.query(Reading)
        .filter(Reading.meter_id == meter_id)
        .order_by(Reading.timestamp.desc())
        .limit(10)
        .all()
    )

    component_details = _derive_component_health(meter, readings)
    component_scores = {
        key: value["health_score"]
        for key, value in component_details.items()
    }

    return {
        "meter_id": meter.id,
        "meter_name": meter.name,
        "overall_health": meter.health_score,
        "overall_status": meter.status,
        "suspected_issue": meter.suspected_issue,
        "components": component_scores,
        "component_details": component_details,
        "last_updated": meter.updated_at.isoformat() if meter.updated_at else None,
    }
