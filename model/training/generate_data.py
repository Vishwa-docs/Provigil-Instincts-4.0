"""
Generate synthetic training data for the ProVigil anomaly-detection model.

Produces two CSV files in ``data/sample/``:
  - ``normal_meters.csv``   – 50 healthy meters, 30 days of hourly readings
  - ``anomalous_meters.csv`` – 20 meters with progressive failure patterns

Can be run standalone::

    python model/training/generate_data.py
    python -m model.training.generate_data
"""

import logging
import math
import os
import random
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, List, Optional

import pandas as pd

# ── Resolve project root so imports work from any CWD ─────────────────────────
_THIS_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _THIS_DIR.parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────
METER_TYPES = ["residential", "commercial", "industrial"]

BASE_LOAD_RANGES = {
    "residential": (0.5, 3.0),
    "commercial":  (5.0, 20.0),
    "industrial":  (50.0, 200.0),
}

FAILURE_SCENARIOS = [
    "loose_terminal",
    "comm_loss",
    "sensor_fault",
    "battery_fault",
    "consumption_anomaly",
]


# ── Daily load-curve helpers (mirrored from simulator) ────────────────────────

def _residential_curve(hour: float) -> float:
    if hour < 5:
        return 0.15 + 0.05 * math.sin(hour * math.pi / 5)
    elif hour < 7:
        return 0.15 + 0.35 * ((hour - 5) / 2)
    elif hour < 9:
        return 0.50 + 0.30 * math.sin((hour - 7) * math.pi / 4)
    elif hour < 12:
        return 0.45 - 0.10 * ((hour - 9) / 3)
    elif hour < 15:
        return 0.35 + 0.05 * math.sin((hour - 12) * math.pi / 3)
    elif hour < 18:
        return 0.40 + 0.30 * ((hour - 15) / 3)
    elif hour < 22:
        return 0.70 + 0.30 * math.sin((hour - 18) * math.pi / 8)
    else:
        return 0.70 - 0.55 * ((hour - 22) / 2)


def _commercial_curve(hour: float) -> float:
    if hour < 7:
        return 0.10 + 0.02 * math.sin(hour)
    elif hour < 9:
        return 0.10 + 0.70 * ((hour - 7) / 2)
    elif hour < 18:
        return 0.80 + 0.15 * math.sin((hour - 9) * math.pi / 9)
    elif hour < 20:
        return 0.80 - 0.50 * ((hour - 18) / 2)
    else:
        return 0.30 - 0.20 * ((hour - 20) / 4)


def _industrial_curve(hour: float) -> float:
    if hour < 6:
        return 0.60 + 0.05 * math.sin(hour)
    elif hour < 22:
        return 0.85 + 0.10 * math.sin((hour - 6) * math.pi / 16)
    else:
        return 0.70 - 0.10 * ((hour - 22) / 2)


_CURVES = {
    "residential": _residential_curve,
    "commercial":  _commercial_curve,
    "industrial":  _industrial_curve,
}


# ── Normal reading generator ─────────────────────────────────────────────────

def _noise(rng: random.Random, scale: float = 1.0) -> float:
    return rng.gauss(0.0, scale)


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def _generate_normal_reading(
    rng: random.Random,
    timestamp: datetime,
    base_load_kw: float,
    meter_type: str,
) -> Dict[str, Any]:
    """Produce a single healthy meter reading."""
    hour = timestamp.hour + timestamp.minute / 60.0
    curve_fn = _CURVES.get(meter_type, _residential_curve)
    load_mult = curve_fn(hour)

    voltage = round(230.0 + _noise(rng, 5.0), 2)
    voltage = _clamp(voltage, 207.0, 253.0)

    power = base_load_kw * load_mult + _noise(rng, base_load_kw * 0.03)
    power = round(max(0.01, power), 3)

    power_factor = round(_clamp(0.92 + _noise(rng, 0.02), 0.85, 0.99), 3)
    current = round(power * 1000.0 / (voltage * power_factor), 3)

    ambient = 35.0 + 5.0 * math.sin((hour - 6) * math.pi / 12)
    temperature = round(ambient + power * 0.05 + _noise(rng, 0.5), 2)
    temperature = _clamp(temperature, 20.0, 55.0)

    frequency = round(50.0 + _noise(rng, 0.1), 3)
    frequency = _clamp(frequency, 49.5, 50.5)

    return {
        "voltage": voltage,
        "current": current,
        "power": power,
        "temperature": temperature,
        "frequency": frequency,
        "power_factor": power_factor,
    }


# ── Fault injectors ──────────────────────────────────────────────────────────

def _inject_loose_terminal(
    rng: random.Random,
    reading: Dict[str, Any],
    progress: float,
) -> Dict[str, Any]:
    p = _clamp(progress, 0.0, 1.0)
    temp_rise = 2.0 + 28.0 * (p ** 1.5)
    reading["temperature"] = round(reading["temperature"] + temp_rise, 2)

    if rng.random() < 0.1 + 0.6 * p:
        drop = rng.uniform(2, 15) * (0.3 + 0.7 * p)
        reading["voltage"] = round(reading["voltage"] - drop, 2)

    noise_scale = 0.5 + 4.0 * p
    reading["current"] = round(max(0.0, reading["current"] + _noise(rng, noise_scale)), 3)
    reading["power_factor"] = round(_clamp(reading["power_factor"] - 0.03 * p, 0.60, 0.99), 3)
    return reading


def _inject_comm_loss(
    rng: random.Random,
    reading: Dict[str, Any],
    progress: float,
) -> Optional[Dict[str, Any]]:
    p = _clamp(progress, 0.0, 1.0)
    if p > 0.90:
        return None
    drop_prob = 0.10 * p if p < 0.5 else 0.10 + 0.70 * (p - 0.5) / 0.5
    if rng.random() < drop_prob:
        return None
    return reading


def _inject_sensor_fault(
    rng: random.Random,
    reading: Dict[str, Any],
    progress: float,
) -> Dict[str, Any]:
    p = _clamp(progress, 0.0, 1.0)

    if p > 0.2 and rng.random() < 0.3 * p:
        reading["voltage"] = 230.00
    if p > 0.3 and rng.random() < 0.3 * p:
        reading["current"] = 0.000
    if p > 0.5 and rng.random() < 0.4 * (p - 0.5):
        reading["power"] = round(-abs(reading["power"]) * rng.uniform(0.5, 2.0), 3)
    if p > 0.6 and rng.random() < 0.3 * p:
        reading["voltage"] = 0.0
    if p > 0.7 and rng.random() < 0.25 * p:
        reading["voltage"] = round(rng.uniform(500, 9999), 2)
    if p > 0.8 and rng.random() < 0.2 * p:
        reading["current"] = round(rng.uniform(500, 65535), 3)
    return reading


def _inject_battery_fault(
    rng: random.Random,
    reading: Dict[str, Any],
    progress: float,
) -> Dict[str, Any]:
    p = _clamp(progress, 0.0, 1.0)
    # Frequency jitter simulating RTC drift effect
    if p > 0.3:
        reading["frequency"] = round(reading["frequency"] + _noise(rng, 0.3 * p), 3)
    # Temperature slight anomaly from battery swelling
    if p > 0.5:
        reading["temperature"] = round(reading["temperature"] + 3.0 * p, 2)
    return reading


def _inject_consumption_anomaly(
    rng: random.Random,
    reading: Dict[str, Any],
    progress: float,
    hour: int,
) -> Dict[str, Any]:
    p = _clamp(progress, 0.0, 1.0)
    is_night = (0 <= hour < 5) or (hour >= 23)

    if is_night and rng.random() < 0.5 + 0.4 * p:
        spike = rng.uniform(3.0, 8.0) * (0.5 + 0.5 * p)
        reading["power"] = round(reading["power"] * spike, 3)
        reading["current"] = round(reading["current"] * spike, 3)

    if rng.random() < 0.25 * p:
        factor = rng.choice([0.05, 0.1, 3.0, 5.0, 8.0])
        reading["power"] = round(reading["power"] * factor, 3)
        reading["current"] = round(reading["current"] * factor, 3)

    if p > 0.4 and rng.random() < 0.2 * p:
        reading["power_factor"] = round(-abs(reading["power_factor"]), 3)

    return reading


_INJECTORS = {
    "loose_terminal":      lambda rng, r, p, h: _inject_loose_terminal(rng, r, p),
    "comm_loss":           lambda rng, r, p, h: _inject_comm_loss(rng, r, p),
    "sensor_fault":        lambda rng, r, p, h: _inject_sensor_fault(rng, r, p),
    "battery_fault":       lambda rng, r, p, h: _inject_battery_fault(rng, r, p),
    "consumption_anomaly": _inject_consumption_anomaly,
}


# ── Data generation ───────────────────────────────────────────────────────────

def generate_meter_readings(
    meter_id: str,
    meter_type: str,
    base_load_kw: float,
    n_hours: int,
    failure_scenario: Optional[str] = None,
    failure_start_hour: int = 0,
    seed: int = 42,
) -> pd.DataFrame:
    """Generate hourly readings for a single meter.

    Parameters
    ----------
    meter_id : str
    meter_type : str – one of ``residential``, ``commercial``, ``industrial``
    base_load_kw : float
    n_hours : int – total duration in hours
    failure_scenario : str or None – fault to inject after ``failure_start_hour``
    failure_start_hour : int – hour offset (from t=0) when fault injection begins
    seed : int

    Returns
    -------
    pd.DataFrame with columns: meter_id, timestamp, voltage, current, power,
    temperature, frequency, power_factor, is_anomaly
    """
    rng = random.Random(seed)
    start_time = datetime(2025, 1, 1, 0, 0, 0)
    rows: List[Dict[str, Any]] = []

    injector = _INJECTORS.get(failure_scenario) if failure_scenario else None
    failure_duration = max(n_hours - failure_start_hour, 1) if failure_scenario else 1

    for h in range(n_hours):
        ts = start_time + timedelta(hours=h)
        reading = _generate_normal_reading(rng, ts, base_load_kw, meter_type)
        is_anomaly = 0

        if injector and h >= failure_start_hour:
            progress = (h - failure_start_hour) / failure_duration
            result = injector(rng, reading, progress, ts.hour)
            if result is None:
                # comm_loss dropped this reading – record as zeros
                reading = {
                    "voltage": 0.0, "current": 0.0, "power": 0.0,
                    "temperature": 0.0, "frequency": 0.0, "power_factor": 0.0,
                }
            else:
                reading = result
            is_anomaly = 1

        rows.append({
            "meter_id": meter_id,
            "timestamp": ts.isoformat(),
            "voltage": reading["voltage"],
            "current": reading["current"],
            "power": reading["power"],
            "temperature": reading["temperature"],
            "frequency": reading["frequency"],
            "power_factor": reading["power_factor"],
            "is_anomaly": is_anomaly,
        })

    return pd.DataFrame(rows)


def generate_normal_fleet(n_meters: int = 50, n_hours: int = 720, seed: int = 42) -> pd.DataFrame:
    """Generate readings for a fleet of healthy meters."""
    rng = random.Random(seed)
    frames: List[pd.DataFrame] = []

    for i in range(n_meters):
        meter_type = rng.choices(METER_TYPES, weights=[0.70, 0.20, 0.10])[0]
        lo, hi = BASE_LOAD_RANGES[meter_type]
        base_load = round(rng.uniform(lo, hi), 2)
        meter_id = f"NRM-{i + 1:03d}"

        df = generate_meter_readings(
            meter_id=meter_id,
            meter_type=meter_type,
            base_load_kw=base_load,
            n_hours=n_hours,
            failure_scenario=None,
            seed=seed + i,
        )
        frames.append(df)

    return pd.concat(frames, ignore_index=True)


def generate_anomalous_fleet(n_meters: int = 20, n_hours: int = 720, seed: int = 1000) -> pd.DataFrame:
    """Generate readings for meters with various failure patterns."""
    rng = random.Random(seed)
    frames: List[pd.DataFrame] = []

    for i in range(n_meters):
        meter_type = rng.choices(METER_TYPES, weights=[0.70, 0.20, 0.10])[0]
        lo, hi = BASE_LOAD_RANGES[meter_type]
        base_load = round(rng.uniform(lo, hi), 2)
        meter_id = f"ANM-{i + 1:03d}"

        scenario = FAILURE_SCENARIOS[i % len(FAILURE_SCENARIOS)]
        # Failure starts between 10% and 40% into the time series
        failure_start = rng.randint(int(n_hours * 0.10), int(n_hours * 0.40))

        df = generate_meter_readings(
            meter_id=meter_id,
            meter_type=meter_type,
            base_load_kw=base_load,
            n_hours=n_hours,
            failure_scenario=scenario,
            failure_start_hour=failure_start,
            seed=seed + i,
        )
        frames.append(df)

    return pd.concat(frames, ignore_index=True)


def main() -> None:
    """Entry point: generate CSVs and write to ``data/sample/``."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    )

    output_dir = _PROJECT_ROOT / "data" / "sample"
    output_dir.mkdir(parents=True, exist_ok=True)

    logger.info("Generating normal meter fleet (50 meters × 720 hours)...")
    normal_df = generate_normal_fleet(n_meters=50, n_hours=720, seed=42)
    normal_path = output_dir / "normal_meters.csv"
    normal_df.to_csv(normal_path, index=False)
    logger.info(
        "Saved %d rows to %s  (%.1f MB)",
        len(normal_df), normal_path, normal_path.stat().st_size / 1e6,
    )

    logger.info("Generating anomalous meter fleet (20 meters × 720 hours)...")
    anomalous_df = generate_anomalous_fleet(n_meters=20, n_hours=720, seed=1000)
    anomalous_path = output_dir / "anomalous_meters.csv"
    anomalous_df.to_csv(anomalous_path, index=False)
    logger.info(
        "Saved %d rows to %s  (%.1f MB)",
        len(anomalous_df), anomalous_path, anomalous_df.memory_usage(deep=True).sum() / 1e6,
    )

    logger.info("Data generation complete.")
    logger.info("  Normal meters:    %d unique IDs", normal_df["meter_id"].nunique())
    logger.info("  Anomalous meters: %d unique IDs", anomalous_df["meter_id"].nunique())
    logger.info("  Anomaly rate in anomalous set: %.1f%%",
                100.0 * anomalous_df["is_anomaly"].mean())


if __name__ == "__main__":
    main()
