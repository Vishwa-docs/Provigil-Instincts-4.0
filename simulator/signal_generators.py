"""
Realistic meter-signal generators with fault-injection functions.

All generators produce dictionaries that match the telemetry schema
expected by the ProVigil ingest pipeline.
"""

import math
import random
from datetime import datetime
from typing import Optional, Dict, Any

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

_rng = random.Random()


def _noise(scale: float = 1.0) -> float:
    """Return Gaussian noise with mean 0 and the given scale (std-dev)."""
    return _rng.gauss(0.0, scale)


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def _hour_of_day(ts: datetime) -> float:
    """Fractional hour-of-day from a datetime."""
    return ts.hour + ts.minute / 60.0 + ts.second / 3600.0


# ---------------------------------------------------------------------------
# Daily load-curve multipliers
# ---------------------------------------------------------------------------

def _residential_curve(hour: float) -> float:
    """
    Residential daily load multiplier (0-1 scale, peaks ~0.9-1.0).

    Pattern: low overnight, morning peak 7-9, dip midday, evening peak 18-22.
    """
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
    """Commercial: high 9-18, low otherwise."""
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
    """Industrial: fairly flat with a slight dip overnight (shift-based)."""
    if hour < 6:
        return 0.60 + 0.05 * math.sin(hour)
    elif hour < 22:
        return 0.85 + 0.10 * math.sin((hour - 6) * math.pi / 16)
    else:
        return 0.70 - 0.10 * ((hour - 22) / 2)


_CURVES = {
    "residential": _residential_curve,
    "commercial": _commercial_curve,
    "industrial": _industrial_curve,
}


# ---------------------------------------------------------------------------
# Normal (healthy) reading generator
# ---------------------------------------------------------------------------

def generate_normal_load(
    timestamp: datetime,
    base_load_kw: float,
    meter_type: str,
) -> Dict[str, Any]:
    """
    Produce a healthy telemetry reading for the given meter at *timestamp*.

    Returns a dict with keys matching the ingest schema:
        voltage, current, power_kw, energy_kwh, temperature,
        frequency, power_factor, raw_data
    """
    hour = _hour_of_day(timestamp)
    curve_fn = _CURVES.get(meter_type, _residential_curve)
    load_mult = curve_fn(hour)

    # Voltage: nominal 230 V ±5 %
    voltage = round(230.0 + _noise(5.0), 2)
    voltage = _clamp(voltage, 207.0, 253.0)

    # Power from base load × daily curve + noise
    power_kw = base_load_kw * load_mult + _noise(base_load_kw * 0.03)
    power_kw = round(max(0.01, power_kw), 3)

    # Power factor
    power_factor = round(_clamp(0.92 + _noise(0.02), 0.85, 0.99), 3)

    # Current = P / (V × pf)  (single phase simplification)
    current = round(power_kw * 1000.0 / (voltage * power_factor), 3)

    # Energy: approximate accumulation (assume 30-s interval → kWh)
    energy_kwh = round(power_kw * (30.0 / 3600.0), 6)

    # Temperature: ambient 30-40 °C + small load-dependent rise
    ambient = 35.0 + 5.0 * math.sin((hour - 6) * math.pi / 12)  # day cycle
    temperature = round(ambient + power_kw * 0.05 + _noise(0.5), 2)
    temperature = _clamp(temperature, 20.0, 55.0)

    # Frequency: 50 Hz ±0.5 %
    frequency = round(50.0 + _noise(0.1), 3)
    frequency = _clamp(frequency, 49.5, 50.5)

    return {
        "voltage": voltage,
        "current": current,
        "power": round(power_kw * 1000.0, 2),  # Convert kW to W for ingest schema
        "energy_import": energy_kwh,
        "temperature": temperature,
        "frequency": frequency,
        "power_factor": power_factor,
        "raw_data": None,
    }


# ---------------------------------------------------------------------------
# Fault injectors
# ---------------------------------------------------------------------------

def inject_loose_terminal(
    readings: Dict[str, Any],
    progress_pct: float,
) -> Dict[str, Any]:
    """
    Simulate a progressively loosening terminal connection.

    progress_pct: 0.0 (just started) → 1.0 (fully degraded).
    Effects:
        - Temperature rise: +2 °C … +30 °C
        - Voltage sag events
        - Current noise / imbalance
    """
    p = _clamp(progress_pct, 0.0, 1.0)

    # Temperature rise (exponential ramp)
    temp_rise = 2.0 + 28.0 * (p ** 1.5)
    readings["temperature"] = round(readings["temperature"] + temp_rise, 2)

    # Voltage drops – occur more often and deeper as p increases
    if _rng.random() < 0.1 + 0.6 * p:
        drop = _rng.uniform(2, 15) * (0.3 + 0.7 * p)
        readings["voltage"] = round(readings["voltage"] - drop, 2)

    # Current imbalance noise grows with progress
    noise_scale = 0.5 + 4.0 * p
    readings["current"] = round(
        readings["current"] + _noise(noise_scale), 3
    )
    readings["current"] = max(0.0, readings["current"])

    # Power factor degrades slightly
    readings["power_factor"] = round(
        _clamp(readings["power_factor"] - 0.03 * p, 0.60, 0.99), 3
    )

    # Add diagnostic hint in raw_data when severe
    if p > 0.6:
        readings["raw_data"] = {"warning": "TERMINAL_TEMP_HIGH", "temperature": readings['temperature']}

    return readings


def inject_comm_loss(
    readings: Dict[str, Any],
    progress_pct: float,
) -> Optional[Dict[str, Any]]:
    """
    Simulate progressive communication degradation.

    Returns None when the reading is "lost" (simulating a gap).
    """
    p = _clamp(progress_pct, 0.0, 1.0)

    # Total blackout after 90 % progress
    if p > 0.90:
        return None

    # Drop probability ramps up
    drop_prob = 0.10 * p if p < 0.5 else 0.10 + 0.70 * (p - 0.5) / 0.5
    if _rng.random() < drop_prob:
        return None

    # Surviving readings may have RSSI degradation note
    if p > 0.3:
        rssi = int(-50 - 40 * p + _noise(3))
        readings["raw_data"] = {"rssi_dbm": rssi, "warning": "COMM_DEGRADATION"}

    return readings


def inject_sensor_fault(
    readings: Dict[str, Any],
    progress_pct: float,
) -> Dict[str, Any]:
    """
    Simulate sensor degradation: stuck values, impossible readings, overflow.
    """
    p = _clamp(progress_pct, 0.0, 1.0)

    # Stuck value: voltage or current freeze on a constant
    if p > 0.2 and _rng.random() < 0.3 * p:
        readings["voltage"] = 230.00  # stuck at nominal

    if p > 0.3 and _rng.random() < 0.3 * p:
        readings["current"] = 0.000  # stuck at zero

    # Impossible / negative values
    if p > 0.5 and _rng.random() < 0.4 * (p - 0.5):
        readings["power"] = round(-abs(readings["power"]) * _rng.uniform(0.5, 2.0), 3)

    if p > 0.6 and _rng.random() < 0.3 * p:
        readings["voltage"] = 0.0

    # Overflow / out-of-range spikes
    if p > 0.7 and _rng.random() < 0.25 * p:
        readings["voltage"] = round(_rng.uniform(500, 9999), 2)

    if p > 0.8 and _rng.random() < 0.2 * p:
        readings["current"] = round(_rng.uniform(500, 65535), 3)

    # Flag in raw_data
    if p > 0.4:
        readings["raw_data"] = {"diagnostic": "SENSOR_FAULT", "fault_score": round(p, 2)}

    return readings


def inject_battery_fault(
    readings: Dict[str, Any],
    progress_pct: float,
) -> Dict[str, Any]:
    """
    Simulate meter-battery degradation: RTC drift, event-log gaps, ERR codes.
    """
    p = _clamp(progress_pct, 0.0, 1.0)

    # RTC drift: report as metadata (downstream will see timestamp issues)
    rtc_drift_sec = int(5 * p ** 2 * 60)  # up to 5 min at 100 %
    if rtc_drift_sec > 0:
        readings["raw_data"] = {
            "battery_voltage": round(3.6 - 1.4 * p, 2),
            "rtc_drift_sec": rtc_drift_sec,
            "event_log_status": "GAP" if p > 0.5 else "OK",
        }

    # At severe levels, inject ERR code
    if p > 0.7 and _rng.random() < 0.4:
        readings["raw_data"] = {
            "error_code": f"0x{_rng.randint(0xE0, 0xFF):02X}",
            "event_code": 14,
            "battery_voltage": round(3.6 - 1.4 * p, 2),
            "rtc_drift_sec": rtc_drift_sec,
        }

    # Occasional energy counter reset when battery is nearly dead
    if p > 0.85 and _rng.random() < 0.15:
        readings["energy_import"] = 0.0

    return readings


def inject_consumption_anomaly(
    readings: Dict[str, Any],
    progress_pct: float,
) -> Dict[str, Any]:
    """
    Simulate consumption patterns suggesting theft or malfunction.

    - Night spikes (unexpected high usage 1-4 AM)
    - Sudden load jumps / drops
    - Inverted power factor (energy flowing backwards)
    """
    p = _clamp(progress_pct, 0.0, 1.0)

    # Night spike: multiply power during off-peak hours
    hour = datetime.now().hour  # approximation; will be overridden by scenario
    is_night = (0 <= hour < 5) or (hour >= 23)

    if is_night and _rng.random() < 0.5 + 0.4 * p:
        spike_factor = _rng.uniform(3.0, 8.0) * (0.5 + 0.5 * p)
        readings["power"] = round(readings["power"] * spike_factor, 3)
        readings["current"] = round(readings["current"] * spike_factor, 3)

    # Sudden load change (any time)
    if _rng.random() < 0.25 * p:
        factor = _rng.choice([0.05, 0.1, 3.0, 5.0, 8.0])
        readings["power"] = round(readings["power"] * factor, 3)
        readings["current"] = round(readings["current"] * factor, 3)

    # Reverse power / negative energy at higher progress
    if p > 0.4 and _rng.random() < 0.2 * p:
        readings["energy_import"] = round(-abs(readings["energy_import"]) * _rng.uniform(1, 3), 6)
        readings["power_factor"] = round(-abs(readings["power_factor"]), 3)

    # Anomaly tag
    if p > 0.3:
        readings["raw_data"] = {"warning": "CONSUMPTION_ANOMALY", "anomaly_score": round(p, 2)}

    return readings
