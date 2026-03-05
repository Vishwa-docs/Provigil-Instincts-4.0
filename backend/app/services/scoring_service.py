"""Anomaly scoring service.

Combines an ML model (Isolation Forest or similar) with deterministic
rule-based checks to produce a per-meter anomaly score, risk level,
suspected failure mode, and contributing factors.

When the ML model is not available on disk the service falls back to
pure rule-based scoring so the platform remains functional.
"""

import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

import sys

import numpy as np
import pandas as pd

from app.config import settings
from app.database import SessionLocal
from app.models.schemas import Anomaly, Alert, Meter, Reading

# Add model training module to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

logger = logging.getLogger(__name__)

# ── ML artefacts (loaded lazily) ──────────────────────────────────────────────

_model: Any = None
_scaler: Any = None
_model_available: bool = False
_feature_columns: List[str] = []

# Raw columns used for basic rule checks
RAW_FEATURE_COLUMNS = [
    "voltage",
    "current",
    "power",
    "temperature",
    "frequency",
    "power_factor",
]


def _load_model() -> None:
    """Attempt to load the ML model and scaler from disk."""
    global _model, _scaler, _model_available, _feature_columns
    try:
        import joblib

        model_path = settings.MODEL_PATH
        scaler_path = settings.SCALER_PATH

        if os.path.isfile(model_path) and os.path.isfile(scaler_path):
            _model = joblib.load(model_path)
            _scaler = joblib.load(scaler_path)
            _model_available = True
            # Load feature columns if available
            feature_cols_path = os.path.join(os.path.dirname(model_path), "feature_columns.json")
            if os.path.isfile(feature_cols_path):
                _feature_columns = json.load(open(feature_cols_path))
            else:
                _feature_columns = RAW_FEATURE_COLUMNS
            logger.info("ML model loaded from %s (%d features)", model_path, len(_feature_columns))
        else:
            _model_available = False
            logger.warning(
                "ML model or scaler not found (%s / %s). Using rule-based fallback.",
                model_path,
                scaler_path,
            )
    except Exception:
        _model_available = False
        logger.exception("Failed to load ML model – falling back to rule-based scoring.")


# ── Rule-based checks ────────────────────────────────────────────────────────


def _rule_high_temp_normal_load(features: Dict[str, Optional[float]]) -> Tuple[float, Optional[str]]:
    """Detect loose terminal / thermal stress.

    Trigger: temperature > 48 °C while current is within normal bounds (< 20 A).
    """
    temp = features.get("temperature")
    curr = features.get("current")
    if temp is not None and curr is not None:
        if temp > 48 and curr < 20:
            severity = min((temp - 48) / 30.0, 1.0)  # scale 48–78 → 0–1
            return severity, "thermal_stress_loose_terminal"
    return 0.0, None


def _rule_zero_readings(features: Dict[str, Optional[float]]) -> Tuple[float, Optional[str]]:
    """Detect communication loss.

    Trigger: voltage, current, and power are all zero or None.
    """
    v = features.get("voltage") or 0
    c = features.get("current") or 0
    p = features.get("power") or 0
    if v == 0 and c == 0 and p == 0:
        return 0.8, "comm_loss_or_power_outage"
    return 0.0, None


def _rule_flatline(readings_df: pd.DataFrame) -> Tuple[float, Optional[str]]:
    """Detect sensor / memory fault.

    Trigger: all readings in the window are identical (constant) and
    non-null for two or more of the key columns.
    """
    if len(readings_df) < 3:
        return 0.0, None

    flat_cols = 0
    for col in ["voltage", "current", "power"]:
        if col in readings_df.columns:
            series = readings_df[col].dropna()
            if len(series) >= 3 and series.nunique() == 1:
                flat_cols += 1
    if flat_cols >= 2:
        return 0.7, "sensor_memory_fault_flatline"
    return 0.0, None


def _rule_rtc_error(features: Dict[str, Optional[float]], raw_data: Optional[dict]) -> Tuple[float, Optional[str]]:
    """Detect clock / RTC battery issue.

    Trigger: event_code in raw_data contains an RTC-related flag, or
    readings jump backwards in time (handled elsewhere).
    """
    if raw_data and isinstance(raw_data, dict):
        event = raw_data.get("event_code")
        if event is not None:
            # Many meters encode RTC errors as specific bit-flags or integer codes.
            # We treat any non-zero event_code as a potential RTC issue for now.
            try:
                code = int(event)
                if code != 0:
                    return 0.5, "rtc_clock_battery_issue"
            except (ValueError, TypeError):
                pass
    return 0.0, None


# ── Failure-mode determination ────────────────────────────────────────────────


def determine_failure_mode(features_dict: Dict[str, Optional[float]],
                           readings_df: Optional[pd.DataFrame] = None,
                           raw_data: Optional[dict] = None) -> Tuple[float, str, List[str]]:
    """Run all rule-based checks and return (score, suspected_issue, contributing_factors).

    The highest individual rule score is used as the aggregate rule score.
    """
    results: List[Tuple[float, Optional[str]]] = []

    results.append(_rule_high_temp_normal_load(features_dict))
    results.append(_rule_zero_readings(features_dict))
    results.append(_rule_rtc_error(features_dict, raw_data))

    if readings_df is not None and not readings_df.empty:
        results.append(_rule_flatline(readings_df))

    max_score = 0.0
    suspected = "unknown"
    factors: List[str] = []

    for score, issue in results:
        if score > 0:
            factors.append(f"{issue} (score={score:.2f})")
        if score > max_score:
            max_score = score
            suspected = issue or "unknown"

    return max_score, suspected, factors


# ── ML-based scoring ─────────────────────────────────────────────────────────


def _ml_score(readings_df: pd.DataFrame) -> float:
    """Score the latest feature window with the ML model.

    Returns a float in [0, 1] where higher = more anomalous.
    Isolation Forest ``decision_function`` returns negative scores for
    anomalies, so we normalise: ``score = -decision_function`` clipped to [0, 1].
    """
    if not _model_available or _model is None or _scaler is None:
        return 0.0

    try:
        # Try to use the feature engineering pipeline
        from model.training.feature_engineering import extract_features, get_feature_columns

        # Ensure required columns exist in the DataFrame
        required = ["timestamp", "voltage", "current", "power", "temperature", "frequency", "power_factor"]
        for col in required:
            if col not in readings_df.columns:
                if col == "timestamp":
                    readings_df = readings_df.copy()
                    readings_df["timestamp"] = pd.date_range(end=pd.Timestamp.now(), periods=len(readings_df), freq="30s")
                else:
                    return 0.0

        engineered = extract_features(readings_df, window_size=min(24, len(readings_df)))
        feat_cols = get_feature_columns()

        # Use the last row's features (most recent)
        valid_rows = engineered[feat_cols].dropna()
        if valid_rows.empty:
            return 0.0

        vector = valid_rows.iloc[-1:].values
        scaled = _scaler.transform(vector)
        raw_score = _model.decision_function(scaled)[0]
        anomaly = float(np.clip(-raw_score, 0.0, 1.0))
        return anomaly

    except ImportError:
        logger.debug("Feature engineering module not available, using raw features")
    except Exception:
        logger.debug("Feature engineering failed, falling back to raw features", exc_info=True)

    # Fallback: use raw features directly (only works if model was trained on raw features)
    feats = readings_df[RAW_FEATURE_COLUMNS].dropna()
    if feats.empty:
        return 0.0

    try:
        vector = feats.mean().values.reshape(1, -1)
        scaled = _scaler.transform(vector)
        raw_score = _model.decision_function(scaled)[0]
        anomaly = float(np.clip(-raw_score, 0.0, 1.0))
        return anomaly
    except Exception:
        logger.debug("Raw-feature scoring also failed", exc_info=True)
        return 0.0


# ── Public scoring API ────────────────────────────────────────────────────────


def score_meter(
    meter_id: str,
    readings_df: pd.DataFrame,
) -> Dict[str, Any]:
    """Score a single meter and return a result dict.

    Returns
    -------
    dict with keys: anomaly_score, risk_level, suspected_issue, contributing_factors
    """
    # Derive latest feature snapshot
    latest_features: Dict[str, Optional[float]] = {}
    if not readings_df.empty:
        last_row = readings_df.iloc[-1]
        for col in RAW_FEATURE_COLUMNS:
            val = last_row.get(col)
            latest_features[col] = None if pd.isna(val) else float(val)

    # Rule-based score
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

    # ML score
    ml_score_val = _ml_score(readings_df)

    # Combine: take the max of ML and rule-based
    combined_score = max(ml_score_val, rule_score)
    if ml_score_val > rule_score and _model_available:
        suspected_issue = "ml_detected_anomaly"
        contributing = rule_factors + [f"ml_score={ml_score_val:.3f}"]
    else:
        suspected_issue = rule_issue
        contributing = rule_factors
        if _model_available:
            contributing.append(f"ml_score={ml_score_val:.3f}")

    # Determine risk level
    if combined_score >= settings.ANOMALY_THRESHOLD_CRITICAL:
        risk_level = "critical"
    elif combined_score >= settings.ANOMALY_THRESHOLD_WARNING:
        risk_level = "warning"
    else:
        risk_level = "low"

    return {
        "anomaly_score": round(combined_score, 4),
        "risk_level": risk_level,
        "suspected_issue": suspected_issue,
        "contributing_factors": contributing,
    }


# ── Scoring cycle ─────────────────────────────────────────────────────────────

WINDOW_SIZE = 30  # number of recent readings to consider


def run_scoring_cycle() -> None:
    """Iterate every meter, score it, and persist results.

    This function is designed to be called periodically by the scheduler.
    """
    # Ensure model is loaded (no-op after first call if file exists)
    if not _model_available:
        _load_model()

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

                # Build DataFrame
                rows = []
                for r in reversed(readings):  # chronological order
                    rows.append({
                        "timestamp": r.timestamp,
                        "voltage": r.voltage,
                        "current": r.current,
                        "power": r.power,
                        "temperature": r.temperature,
                        "frequency": r.frequency,
                        "power_factor": r.power_factor,
                        "raw_data": r.raw_data,
                    })
                df = pd.DataFrame(rows)

                result = score_meter(meter.id, df)

                # Update meter
                health = round(1.0 - result["anomaly_score"], 4)
                meter.health_score = health
                meter.status = (
                    "critical" if result["risk_level"] == "critical"
                    else "warning" if result["risk_level"] == "warning"
                    else "healthy"
                )
                meter.suspected_issue = result["suspected_issue"] if result["risk_level"] != "low" else None
                meter.updated_at = datetime.now(timezone.utc)

                # Create Anomaly record if above warning threshold
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

                    # Create Alert
                    severity = "critical" if result["risk_level"] == "critical" else "warning"
                    alert = Alert(
                        meter_id=meter.id,
                        alert_type="anomaly",
                        severity=severity,
                        message=(
                            f"Anomaly detected on {meter.name}: "
                            f"score={result['anomaly_score']:.2f}, "
                            f"issue={result['suspected_issue']}"
                        ),
                    )
                    db.add(alert)

            except Exception:
                logger.exception("Error scoring meter %s", meter.id)

        db.commit()
        logger.info("Scoring cycle complete.")
    except Exception:
        db.rollback()
        logger.exception("Scoring cycle failed.")
    finally:
        db.close()
