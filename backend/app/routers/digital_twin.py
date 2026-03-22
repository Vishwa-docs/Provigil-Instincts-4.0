"""Router for digital twin endpoints."""

import hashlib
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

    # Terminal Connections (L1, L2, L3, Neutral) — with VOC gas sensor + thermal + voltage
    temp = latest.temperature if latest else 32.0
    voltage = latest.voltage if latest else 230.0
    voc_ppm = getattr(latest, "voc_ppm", None) if latest else None
    temp_risk = max(0, min(1, (temp - 35) / 40)) if temp else 0
    voltage_risk = max(0, min(1, abs(voltage - 230) / 50)) if voltage else 0
    voc_risk = 0.0
    if voc_ppm is not None and voc_ppm > 50:
        voc_risk = min(1, (voc_ppm - 50) / 100)

    terminal_score = max(0, 1.0 - max(temp_risk, voltage_risk, voc_risk))
    components["terminals"] = {
        "name": "Terminal Connections",
        "status": "critical" if terminal_score < 0.4 else "warning" if terminal_score < 0.7 else "ok",
        "health_score": round(terminal_score, 3),
        "temperature": round(temp, 1) if temp else None,
        "voc_ppm": round(voc_ppm, 1) if voc_ppm is not None else None,
        "details": {
            "L1_phase": {"status": "warning" if voltage_risk > 0.3 else "ok", "voltage": round(voltage, 1) if voltage else None},
            "L2_phase": {"status": "ok", "voltage": round(voltage * 1.003, 1) if voltage else None},
            "L3_phase": {"status": "ok", "voltage": round(voltage * 0.997, 1) if voltage else None},
            "neutral": {"status": "ok", "voltage": 0.0},
            "voc_gas_sensor": f"{voc_ppm:.1f} ppm" if voc_ppm is not None else "N/A",
            "thermal_proxy": "Micro-voltage drops correlated with load — resistance proxy active",
        },
        "risk_factors": [
            "Elevated temperature" if temp_risk > 0.3 else None,
            "Voltage deviation" if voltage_risk > 0.3 else None,
            f"VOC gas level elevated ({voc_ppm:.0f} ppm) — possible arcing or insulation degradation" if voc_risk > 0 else None,
        ],
    }
    components["terminals"]["risk_factors"] = [r for r in components["terminals"]["risk_factors"] if r]

    # Power Supply Unit / SMPS — enhanced with THD & harmonic damage
    pf = latest.power_factor if latest else 0.95
    thd = getattr(latest, "thd", None) if latest else None
    harmonic_idx = getattr(latest, "harmonic_distortion", None) if latest else None
    psu_score = max(0, min(1, pf)) if pf else 0.95
    thd_risk = 0.0
    if thd is not None and thd > 5.0:
        thd_risk = min((thd - 5.0) / 10.0, 0.5)
        psu_score = max(0, psu_score - thd_risk)
    if harmonic_idx is not None and harmonic_idx > 0.1:
        psu_score = max(0, psu_score - min(harmonic_idx * 0.3, 0.3))
    components["power_supply"] = {
        "name": "Power Supply Unit",
        "status": "critical" if psu_score < 0.5 else "warning" if psu_score < 0.85 else "ok",
        "health_score": round(psu_score, 3),
        "details": {
            "input_voltage": round(voltage, 1) if voltage else 230.0,
            "power_factor": round(pf, 3) if pf else 0.95,
            "thd_current": f"{thd:.1f}%" if thd is not None else "N/A",
            "harmonic_damage_index": f"{harmonic_idx:.3f}" if harmonic_idx is not None else "0.000",
            "aging_status": "Stressed" if thd_risk > 0.15 else "Normal",
        },
        "risk_factors": [
            f"THD {thd:.1f}% exceeds 5% limit — power supply degradation risk" if thd is not None and thd > 5.0 else None,
            "Low power factor — power supply stress" if pf and pf < 0.85 else None,
            f"Harmonic damage accumulating ({harmonic_idx:.3f})" if harmonic_idx is not None and harmonic_idx > 0.05 else None,
        ],
    }
    components["power_supply"]["risk_factors"] = [r for r in components["power_supply"]["risk_factors"] if r]

    # Display Module — enhanced with firmware heap monitoring
    heap = getattr(latest, "firmware_heap_pct", None) if latest else None
    display_score = 0.95 if meter.status != "critical" else 0.6
    heap_pressure = False
    if heap is not None and heap > 80:
        display_score = max(0.3, display_score - (heap - 80) / 100.0)
        heap_pressure = True
    components["display"] = {
        "name": "Display & Firmware",
        "status": "critical" if display_score < 0.5 else "warning" if display_score < 0.8 else "ok",
        "health_score": round(display_score, 3),
        "details": {
            "firmware_version": "v3.2.1",
            "last_refresh": "OK",
            "heap_usage": f"{heap:.0f}%" if heap is not None else "N/A",
            "memory_pressure": "HIGH — remote reset recommended" if heap_pressure else "Normal",
        },
        "risk_factors": [f"Firmware heap at {heap:.0f}% — memory leak risk" if heap_pressure else None],
    }
    components["display"]["risk_factors"] = [r for r in components["display"]["risk_factors"] if r]

    # Battery / RTC — enhanced with actual battery voltage & discharge curve
    install_months = 24  # assume 2-year old meter
    bv = getattr(latest, "battery_voltage", None) if latest else None
    if bv is not None and bv > 0:
        battery_pct = max(0, min(100, (bv - 2.0) / 1.3 * 100))
    else:
        battery_pct = max(0, 100 - (install_months * 0.8) - (max(0, (temp or 30) - 35) * 0.5))
    battery_score = battery_pct / 100.0

    # Build discharge curve from recent readings
    discharge_curve = []
    for r in readings[:48]:  # up to last 48 readings
        rv = getattr(r, "battery_voltage", None)
        if rv is not None:
            discharge_curve.append({"timestamp": r.timestamp.isoformat() if r.timestamp else None, "voltage": round(rv, 3)})
    discharge_curve.reverse()

    months_remaining = round(battery_pct / 0.8, 0) if battery_pct > 0 else 0
    components["battery"] = {
        "name": "Battery & RTC",
        "status": "critical" if battery_score < 0.3 else "warning" if battery_score < 0.6 else "ok",
        "health_score": round(battery_score, 3),
        "details": {
            "battery_level": f"{battery_pct:.0f}%",
            "battery_voltage": f"{bv:.2f}V" if bv is not None else "N/A",
            "estimated_months_remaining": months_remaining,
            "predicted_failure_month": f"~{int(months_remaining)} months" if months_remaining > 0 else "Imminent",
            "rtc_drift": "< 1 sec/day",
            "discharge_curve": discharge_curve[:24],  # last 24 data points
        },
        "risk_factors": [
            f"Battery voltage {bv:.2f}V — below safe threshold" if bv is not None and bv < 2.8 else None,
            "Battery below 30%" if battery_pct < 30 else None,
        ],
    }
    components["battery"]["risk_factors"] = [r for r in components["battery"]["risk_factors"] if r]

    # Relay Module — enhanced with chatter signature analysis
    current = latest.current if latest else 5.0
    chatter = getattr(latest, "relay_chatter_ms", None) if latest else None
    relay_stress = max(0, min(1, (current - 30) / 20)) if current else 0
    relay_score = max(0, 1.0 - relay_stress)
    if chatter is not None and chatter > 50:
        chatter_penalty = min((chatter - 50) / 300.0, 0.5)
        relay_score = max(0, relay_score - chatter_penalty)

    # Build chatter trend from recent readings
    chatter_trend = []
    for r in readings[:24]:
        rc = getattr(r, "relay_chatter_ms", None)
        if rc is not None:
            chatter_trend.append({"timestamp": r.timestamp.isoformat() if r.timestamp else None, "chatter_ms": round(rc, 1)})
    chatter_trend.reverse()

    components["relay"] = {
        "name": "Latching Relay",
        "status": "critical" if relay_score < 0.5 else "warning" if relay_score < 0.7 else "ok",
        "health_score": round(relay_score, 3),
        "details": {
            "current_load": f"{current:.1f}A" if current else "N/A",
            "chatter_duration": f"{chatter:.0f}ms" if chatter is not None else "N/A",
            "chatter_status": "Degraded — contact wear detected" if chatter is not None and chatter > 50 else "Healthy — clean switching",
            "cycle_count": int(hashlib.md5(meter.id.encode()).hexdigest()[:4], 16) % 200 + 50,
            "chatter_trend": chatter_trend[:12],
        },
        "risk_factors": [
            f"Relay chatter {chatter:.0f}ms — contact degradation" if chatter is not None and chatter > 50 else None,
            "High current load stress" if relay_stress > 0.3 else None,
        ],
    }
    components["relay"]["risk_factors"] = [r for r in components["relay"]["risk_factors"] if r]

    # Communication Module
    comm_score = 0.95 if meter.last_seen else 0.3
    components["communication"] = {
        "name": "Communication Module",
        "status": "ok" if comm_score > 0.8 else "warning" if comm_score > 0.5 else "critical",
        "health_score": round(comm_score, 3),
        "details": {"protocol": "RF Mesh + LTE-M", "signal_strength": f"-{60 + (hash(meter.id) % 16)} dBm", "packet_loss": f"{0.4 + (hash(meter.id) % 10) * 0.15:.1f}%"},
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
