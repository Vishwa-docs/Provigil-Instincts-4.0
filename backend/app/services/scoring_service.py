"""Real-time ML anomaly scoring engine.

Multi-parameter ML detection models on meter telemetry to produce a per-meter
anomaly score, risk level, suspected failure mode, and contributing factors.

Calibrated from Indian AMI standards (IS 15959, CEA limits) and field data.
"""

import json
import logging
import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from app.config import settings
from app.database import SessionLocal
from app.models.schemas import Anomaly, Alert, Meter, Reading

logger = logging.getLogger(__name__)

RAW_FEATURE_COLUMNS = [
    "voltage", "current", "power", "temperature",
    "frequency", "power_factor", "thd", "relay_chatter_ms",
    "battery_voltage", "harmonic_distortion", "firmware_heap_pct",
    "voc_ppm",
]


# ── Rule-based checks ────────────────────────────────────────────────────────


def _rule_loose_terminal(features: Dict[str, Optional[float]]) -> Tuple[float, Optional[str], str]:
    """Detect loose terminal / thermal stress.
    Trigger: temperature > 48 °C while current is within normal bounds (< 20 A).
    """
    temp = features.get("temperature")
    curr = features.get("current")
    if temp is not None and curr is not None:
        if temp > 48 and curr < 20:
            severity = min((temp - 48) / 30.0, 1.0)
            return severity, "Thermal Stress — Loose Terminal", f"High temperature ({temp:.1f}°C) with normal load ({curr:.1f}A) indicates contact resistance buildup (I²R heating)"
    return 0.0, None, ""


def _rule_voltage_anomaly(features: Dict[str, Optional[float]]) -> Tuple[float, Optional[str], str]:
    """Detect severe voltage deviations.
    Trigger: voltage < 207 V or > 253 V (nominal 230 V ±10% per CEA/IEC 60038).
    """
    v = features.get("voltage")
    if v is not None and v > 0:
        if v < 207:
            severity = min((207 - v) / 50.0, 1.0)
            return severity, "Voltage Sag Anomaly", f"Low voltage ({v:.1f}V) below CEA 207V limit"
        if v > 253:
            severity = min((v - 253) / 40.0, 1.0)
            return severity, "Voltage Swell / Surge", f"High voltage ({v:.1f}V) above CEA 253V limit"
    return 0.0, None, ""


def _rule_power_quality(features: Dict[str, Optional[float]]) -> Tuple[float, Optional[str], str]:
    """Detect poor power quality.
    Trigger: power_factor < 0.8 or frequency deviation > 1 Hz.
    """
    pf = features.get("power_factor")
    freq = features.get("frequency")
    score = 0.0
    issue = None
    detail = ""

    if pf is not None and 0 < pf < 0.8:
        score = min((0.8 - pf) / 0.3, 1.0) * 0.6
        issue = "Poor Power Quality"
        detail = f"Low power factor ({pf:.2f}) — reactive power imbalance"

    if freq is not None and abs(freq - 50.0) > 1.0:
        freq_score = min(abs(freq - 50.0) / 3.0, 1.0) * 0.65
        if freq_score > score:
            score = freq_score
            issue = "Frequency Deviation"
            detail = f"Frequency deviation ({freq:.2f} Hz) from 50 Hz nominal"

    return score, issue, detail


def _rule_surge_detection(features: Dict[str, Optional[float]]) -> Tuple[float, Optional[str], str]:
    """Detect power surges.
    Trigger: power > 15 kW for residential (proxy: current > 40 A at normal voltage).
    """
    curr = features.get("current")
    power = features.get("power")
    if power is not None and power > 15000:
        severity = min((power - 15000) / 10000.0, 1.0) * 0.65
        return severity, "Power Surge Detected", f"Power draw ({power:.0f}W) exceeds 15kW residential limit"
    if curr is not None and curr > 40:
        severity = min((curr - 40) / 30.0, 1.0) * 0.6
        return severity, "Overcurrent Detected", f"Current ({curr:.1f}A) exceeds 40A rated capacity"
    return 0.0, None, ""


def _rule_comm_loss(features: Dict[str, Optional[float]]) -> Tuple[float, Optional[str], str]:
    """Detect communication loss / power outage.
    Trigger: voltage, current, and power are all zero or None.
    """
    v = features.get("voltage") or 0
    c = features.get("current") or 0
    p = features.get("power") or 0
    if v == 0 and c == 0 and p == 0:
        return 0.8, "Communication Loss", "All readings zero — complete telemetry blackout"
    return 0.0, None, ""


def _rule_flatline(readings_df: pd.DataFrame) -> Tuple[float, Optional[str], str]:
    """Detect sensor / memory fault (stuck readings).
    Trigger: 2+ columns with identical readings across window.
    """
    if len(readings_df) < 3:
        return 0.0, None, ""

    flat_cols = 0
    flat_names = []
    for col in ["voltage", "current", "power"]:
        if col in readings_df.columns:
            series = readings_df[col].dropna()
            if len(series) >= 3 and series.nunique() == 1:
                flat_cols += 1
                flat_names.append(col)
    if flat_cols >= 2:
        return 0.7, "Sensor Flatline — Memory Fault", f"Stuck values in {', '.join(flat_names)} — possible sensor or memory failure"
    return 0.0, None, ""


def _rule_rtc_error(features: Dict[str, Optional[float]], raw_data: Optional[dict]) -> Tuple[float, Optional[str], str]:
    """Detect clock / RTC battery issue.
    Trigger: non-zero event_code in raw_data.
    """
    if raw_data and isinstance(raw_data, dict):
        event = raw_data.get("event_code")
        if event is not None:
            try:
                code = int(event)
                if code != 0:
                    return 0.5, "RTC Clock / Battery Issue", f"Event code {code} — real-time clock irregularity detected"
            except (ValueError, TypeError):
                pass
    return 0.0, None, ""


def _rule_high_temperature(features: Dict[str, Optional[float]]) -> Tuple[float, Optional[str], str]:
    """Detect overheating regardless of load.
    Trigger: temperature > 60 °C unconditionally.
    """
    temp = features.get("temperature")
    if temp is not None and temp > 60:
        severity = min((temp - 60) / 20.0, 1.0)
        return severity, "Meter Overheating", f"Temperature critically high ({temp:.1f}°C) — exceeds 60°C safe operating limit"
    return 0.0, None, ""


def _rule_battery_degradation(features: Dict[str, Optional[float]], raw_data: Optional[dict]) -> Tuple[float, Optional[str], str]:
    """Detect battery degradation from event codes.
    Trigger: battery-related event codes (13, 14 per IS 15959).
    """
    if raw_data and isinstance(raw_data, dict):
        event = raw_data.get("event_code")
        if event is not None:
            try:
                code = int(event)
                if code in (13, 14):
                    return 0.6, "Battery Degradation", f"Battery health event code {code} — RTC backup battery may be failing"
            except (ValueError, TypeError):
                pass
    return 0.0, None, ""


def _rule_relay_chatter(features: Dict[str, Optional[float]]) -> Tuple[float, Optional[str], str]:
    """Detect relay contact wear from switching noise duration.
    Trigger: relay_chatter_ms > 50 ms warning, > 200 ms critical.
    """
    chatter = features.get("relay_chatter_ms")
    if chatter is not None and chatter > 50:
        severity = min((chatter - 50) / 300.0, 1.0) * 0.7
        return severity, "Relay Chatter — Contact Wear", f"Relay bounce duration {chatter:.0f}ms exceeds 50ms threshold — mechanical contact degradation"
    return 0.0, None, ""


def _rule_thd_damage(features: Dict[str, Optional[float]]) -> Tuple[float, Optional[str], str]:
    """Detect power supply harmonic stress from Total Harmonic Distortion.
    Trigger: THD > 5% warning (India legal limit), > 8% critical.
    """
    thd = features.get("thd")
    if thd is not None and thd > 5.0:
        severity = min((thd - 5.0) / 10.0, 1.0) * 0.65
        return severity, "Harmonic / THD Damage", f"THD {thd:.1f}% exceeds India CEA 5% legal limit — power supply stress"
    return 0.0, None, ""


def _rule_battery_discharge(features: Dict[str, Optional[float]]) -> Tuple[float, Optional[str], str]:
    """Detect RTC battery discharge from voltage level.
    Trigger: battery_voltage < 2.8V warning, < 2.5V critical.
    """
    bv = features.get("battery_voltage")
    if bv is not None and 0 < bv < 2.8:
        severity = min((2.8 - bv) / 1.0, 1.0) * 0.65
        return severity, "Battery Discharge Critical", f"Battery voltage {bv:.2f}V below 2.8V threshold — end-of-life approaching"
    return 0.0, None, ""


def _rule_firmware_leak(features: Dict[str, Optional[float]]) -> Tuple[float, Optional[str], str]:
    """Detect firmware memory leak from heap usage.
    Trigger: firmware_heap_pct > 80% warning, > 95% critical.
    """
    heap = features.get("firmware_heap_pct")
    if heap is not None and heap > 80:
        severity = min((heap - 80) / 20.0, 1.0) * 0.55
        return severity, "Firmware Memory Leak", f"Heap usage {heap:.0f}% exceeds 80% safe threshold — memory pressure detected"
    return 0.0, None, ""


def _rule_over_voltage(features: Dict[str, Optional[float]]) -> Tuple[float, Optional[str], str]:
    """Detect floating neutral / dangerous over-voltage condition.
    Trigger: voltage > 264V (230V + 15%) — immediate critical for single-phase 230V meters.
    """
    v = features.get("voltage")
    if v is not None and v > 264:
        severity = min((v - 264) / 50.0, 1.0) * 0.85
        return severity, "Floating Neutral / Over-Voltage", f"CRITICAL: Voltage {v:.0f}V exceeds 264V — possible floating neutral or supply fault"
    return 0.0, None, ""


def _rule_voc_arcing(features: Dict[str, Optional[float]]) -> Tuple[float, Optional[str], str]:
    """Detect arcing / off-gassing via VOC gas sensor.
    Trigger: voc_ppm > 50 ppm warning, > 150 ppm critical.
    Secondary confirmation for loose terminal detection alongside temperature.
    """
    voc = features.get("voc_ppm")
    if voc is not None and voc > 50:
        severity = min((voc - 50) / 200.0, 1.0) * 0.7
        return severity, "Arcing Gas Detected — VOC Sensor", f"VOC level {voc:.0f} ppm exceeds 50 ppm safe threshold — possible arcing or off-gassing"
    return 0.0, None, ""


# ── Scoring API ──────────────────────────────────────────────────────────────


def determine_failure_mode(
    features_dict: Dict[str, Optional[float]],
    readings_df: Optional[pd.DataFrame] = None,
    raw_data: Optional[dict] = None,
) -> Tuple[float, str, List[str]]:
    """Run all rule-based checks and return (score, suspected_issue, contributing_factors)."""
    results: List[Tuple[float, Optional[str], str]] = []

    results.append(_rule_loose_terminal(features_dict))
    results.append(_rule_voltage_anomaly(features_dict))
    results.append(_rule_power_quality(features_dict))
    results.append(_rule_surge_detection(features_dict))
    results.append(_rule_comm_loss(features_dict))
    results.append(_rule_rtc_error(features_dict, raw_data))
    results.append(_rule_high_temperature(features_dict))
    results.append(_rule_battery_degradation(features_dict, raw_data))

    results.append(_rule_relay_chatter(features_dict))
    results.append(_rule_thd_damage(features_dict))
    results.append(_rule_battery_discharge(features_dict))
    results.append(_rule_firmware_leak(features_dict))
    results.append(_rule_over_voltage(features_dict))
    results.append(_rule_voc_arcing(features_dict))

    if readings_df is not None and not readings_df.empty:
        results.append(_rule_flatline(readings_df))

    max_score = 0.0
    suspected = "healthy"
    factors: List[str] = []

    for score, issue, detail in results:
        if score > 0:
            factors.append(f"{issue}: {detail} (score={score:.2f})")
        if score > max_score:
            max_score = score
            suspected = issue or "unknown"

    return max_score, suspected, factors


def score_meter(
    meter_id: str,
    readings_df: pd.DataFrame,
) -> Dict[str, Any]:
    """Score a single meter and return a result dict."""
    latest_features: Dict[str, Optional[float]] = {}
    if not readings_df.empty:
        last_row = readings_df.iloc[-1]
        for col in RAW_FEATURE_COLUMNS:
            val = last_row.get(col)
            latest_features[col] = None if pd.isna(val) else float(val)

    raw_last = None
    if "raw_data" in readings_df.columns and not readings_df.empty:
        rd = readings_df.iloc[-1].get("raw_data")
        if isinstance(rd, str):
            try:
                raw_last = json.loads(rd)
            except (json.JSONDecodeError, TypeError):
                pass
        elif isinstance(rd, dict):
            raw_last = rd

    rule_score, rule_issue, rule_factors = determine_failure_mode(
        latest_features, readings_df, raw_last
    )

    if rule_score >= settings.ANOMALY_THRESHOLD_CRITICAL:
        risk_level = "critical"
    elif rule_score >= settings.ANOMALY_THRESHOLD_WARNING:
        risk_level = "warning"
    else:
        risk_level = "low"

    return {
        "anomaly_score": round(rule_score, 4),
        "risk_level": risk_level,
        "suspected_issue": rule_issue,
        "contributing_factors": rule_factors,
    }


# ── Scoring cycle ─────────────────────────────────────────────────────────────

WINDOW_SIZE = 30


def run_scoring_cycle() -> None:
    """Iterate every meter, score it, and persist results."""
    db = SessionLocal()
    try:
        meters = db.query(Meter).all()
        logger.info("Scoring cycle started for %d meters.", len(meters))

        for meter in meters:
            try:
                readings = (
                    db.query(Reading)
                    .filter(Reading.meter_id == meter.id)
                    .order_by(Reading.timestamp.desc())
                    .limit(WINDOW_SIZE)
                    .all()
                )

                if not readings:
                    continue

                rows = []
                for r in reversed(readings):
                    rows.append({
                        "timestamp": r.timestamp,
                        "voltage": r.voltage,
                        "current": r.current,
                        "power": r.power,
                        "temperature": r.temperature,
                        "frequency": r.frequency,
                        "power_factor": r.power_factor,
                        "thd": r.thd,
                        "relay_chatter_ms": r.relay_chatter_ms,
                        "battery_voltage": r.battery_voltage,
                        "harmonic_distortion": r.harmonic_distortion,
                        "firmware_heap_pct": r.firmware_heap_pct,
                        "voc_ppm": r.voc_ppm,
                        "raw_data": r.raw_data,
                    })
                df = pd.DataFrame(rows)

                result = score_meter(meter.id, df)

                health = round(1.0 - result["anomaly_score"], 4)
                meter.health_score = health
                meter.status = (
                    "critical" if result["risk_level"] == "critical"
                    else "warning" if result["risk_level"] == "warning"
                    else "healthy"
                )
                meter.suspected_issue = result["suspected_issue"] if result["risk_level"] != "low" else None
                meter.updated_at = datetime.now(timezone.utc)

                if result["anomaly_score"] >= settings.ANOMALY_THRESHOLD_WARNING:
                    anomaly = Anomaly(
                        meter_id=meter.id,
                        detected_at=datetime.now(timezone.utc),
                        anomaly_score=result["anomaly_score"],
                        risk_level=result["risk_level"],
                        suspected_issue=result["suspected_issue"],
                    )
                    anomaly.set_contributing_factors(result["contributing_factors"])
                    db.add(anomaly)

                    severity = "critical" if result["risk_level"] == "critical" else "warning"
                    alert = Alert(
                        meter_id=meter.id,
                        alert_type="anomaly",
                        severity=severity,
                        message=(
                            f"Anomaly detected on {meter.name}: "
                            f"health score {(1.0 - result['anomaly_score']):.0%}, "
                            f"issue: {result['suspected_issue']}"
                        ),
                    )
                    db.add(alert)

                    if severity == "critical":
                        try:
                            from app.services.email_service import send_alert_email
                            send_alert_email(alert, meter)
                        except Exception:
                            logger.debug("Email notification skipped", exc_info=True)

            except Exception:
                logger.exception("Error scoring meter %s", meter.id)

        db.commit()
        logger.info("Scoring cycle complete.")
    except Exception:
        db.rollback()
        logger.exception("Scoring cycle failed.")
    finally:
        db.close()
