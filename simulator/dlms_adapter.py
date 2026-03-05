"""
DLMS/COSEM mock adapter for ProVigil smart-meter simulation.

Simulates:
- An IS 15959 compliant DLMS smart meter producing push-data frames
- A Head-End System (HES) that forwards frames to the ProVigil backend

Usage::

    python -m simulator.dlms_adapter --meters 10 --interval 30

"""

import argparse
import json
import logging
import math
import random
import sys
import time
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

import requests

from simulator.dlms_event_codes import EVENT_CODES, get_event_by_code

logger = logging.getLogger(__name__)

# ── OBIS code mapping (IS 15959 / IEC 62056-6-1) ────────────────────────────

OBIS_MAPPING: Dict[str, Dict[str, Any]] = {
    "1-0:1.8.0":  {"name": "energy_active_import",  "unit": "kWh", "scaler": 0.001},
    "1-0:2.8.0":  {"name": "energy_active_export",  "unit": "kWh", "scaler": 0.001},
    "1-0:32.7.0": {"name": "voltage_l1",            "unit": "V",   "scaler": 0.1},
    "1-0:52.7.0": {"name": "voltage_l2",            "unit": "V",   "scaler": 0.1},
    "1-0:72.7.0": {"name": "voltage_l3",            "unit": "V",   "scaler": 0.1},
    "1-0:31.7.0": {"name": "current_l1",            "unit": "A",   "scaler": 0.01},
    "1-0:51.7.0": {"name": "current_l2",            "unit": "A",   "scaler": 0.01},
    "1-0:71.7.0": {"name": "current_l3",            "unit": "A",   "scaler": 0.01},
    "1-0:1.7.0":  {"name": "power_active_import",   "unit": "W",   "scaler": 1},
    "1-0:14.7.0": {"name": "frequency",             "unit": "Hz",  "scaler": 0.01},
    "1-0:13.7.0": {"name": "power_factor",          "unit": "",    "scaler": 0.001},
    "0-0:96.1.0": {"name": "meter_serial",          "unit": "",    "scaler": 1},
    "0-0:1.0.0":  {"name": "clock",                 "unit": "",    "scaler": 1},
    "0-0:96.8.0": {"name": "operating_time",        "unit": "s",   "scaler": 1},
    "0-0:96.7.0": {"name": "event_code",            "unit": "",    "scaler": 1},
    "1-0:0.8.0":  {"name": "demand_max",            "unit": "W",   "scaler": 1},
}

# Reverse lookup: internal name → OBIS code
_NAME_TO_OBIS: Dict[str, str] = {
    v["name"]: k for k, v in OBIS_MAPPING.items()
}

# ── Helpers ──────────────────────────────────────────────────────────────────

_rng = random.Random()


def _noise(scale: float = 1.0) -> float:
    """Gaussian noise with mean 0."""
    return _rng.gauss(0.0, scale)


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def _residential_curve(hour: float) -> float:
    """Normalised residential load curve (0 → 1)."""
    if hour < 5:
        return 0.15 + 0.05 * math.sin(hour * math.pi / 5)
    elif hour < 7:
        return 0.15 + 0.35 * ((hour - 5) / 2)
    elif hour < 9:
        return 0.50 + 0.30 * math.sin((hour - 7) * math.pi / 4)
    elif hour < 12:
        return 0.35 + 0.10 * math.sin((hour - 9) * math.pi / 6)
    elif hour < 17:
        return 0.30 + 0.05 * math.sin((hour - 12) * math.pi / 10)
    elif hour < 21:
        return 0.45 + 0.55 * math.sin((hour - 17) * math.pi / 8)
    else:
        return 0.40 - 0.25 * ((hour - 21) / 3)


# ── DLMSMeterSimulator ──────────────────────────────────────────────────────


class DLMSMeterSimulator:
    """Generates realistic DLMS/COSEM push frames for a single meter.

    Parameters
    ----------
    meter_id:
        Unique meter identifier (e.g. ``"M-DLMS-001"``).
    base_load_kw:
        Baseline active-power draw in kilowatts.  The actual power varies
        according to a time-of-day curve and random noise.
    """

    def __init__(self, meter_id: str, base_load_kw: float = 2.0) -> None:
        self.meter_id = meter_id
        self.base_load_kw = base_load_kw

        # Cumulative energy counters
        self._energy_import_kwh: float = _rng.uniform(1000.0, 50000.0)
        self._energy_export_kwh: float = _rng.uniform(0.0, 500.0)

        # Operating-time counter (seconds since commissioning)
        self._operating_time_s: int = _rng.randint(86400 * 30, 86400 * 365 * 3)

        # Peak demand seen during the current billing period
        self._peak_demand_w: float = base_load_kw * 1000 * _rng.uniform(1.1, 1.5)

        # TOU register buckets (kWh) — 4 zones typical in India
        self._tou: Dict[str, float] = {
            "zone1_peak":      _rng.uniform(200, 5000),
            "zone2_off_peak":  _rng.uniform(500, 10000),
            "zone3_shoulder":  _rng.uniform(300, 6000),
            "zone4_night":     _rng.uniform(400, 8000),
        }

        # Internal temperature in °C (ambient + self-heating)
        self._temperature: float = _rng.uniform(30.0, 42.0)

        # Last event code generated
        self._last_event_code: int = 0

        # Billing snapshot month counter
        self._billing_month: int = 0

    # ── Push data frame ──────────────────────────────────────────────────

    def generate_push_frame(self) -> Dict[str, Any]:
        """Build a complete DLMS COSEM push-data frame.

        Returns a dict with ``meter_id``, ``timestamp``, ``registers`` (OBIS
        code → raw integer value), and ``event_log``.  The backend can
        translate *registers* via the OBIS mapper.
        """
        now = datetime.now(timezone.utc)
        hour = now.hour + now.minute / 60.0

        load_mult = _residential_curve(hour)
        power_w = self.base_load_kw * 1000.0 * load_mult + _noise(50)
        power_w = _clamp(power_w, 0.0, self.base_load_kw * 1000 * 2.5)

        # Update cumulative energy (approximate Wh over interval)
        interval_h = 30.0 / 3600.0  # assume ~30 s between frames
        self._energy_import_kwh += (power_w / 1000.0) * interval_h
        self._energy_export_kwh += max(0, _noise(0.01)) * interval_h
        self._operating_time_s += 30

        # Track peak demand
        if power_w > self._peak_demand_w:
            self._peak_demand_w = power_w

        # Sensor values
        nominal_v = 230.0
        voltage_l1 = nominal_v + _noise(3.0)
        voltage_l2 = nominal_v + _noise(3.0)
        voltage_l3 = nominal_v + _noise(3.0)
        pf = _clamp(0.92 + _noise(0.03), 0.70, 1.00)
        current_l1 = power_w / (voltage_l1 * pf * 3.0) + _noise(0.05) if voltage_l1 > 0 else 0
        current_l2 = power_w / (voltage_l2 * pf * 3.0) + _noise(0.05) if voltage_l2 > 0 else 0
        current_l3 = power_w / (voltage_l3 * pf * 3.0) + _noise(0.05) if voltage_l3 > 0 else 0
        frequency = 50.0 + _noise(0.05)

        # Temperature drifts slowly
        self._temperature += _noise(0.2)
        self._temperature = _clamp(self._temperature, 20.0, 85.0)

        # Possibly generate an event
        self._last_event_code = 0
        if _rng.random() < 0.05:  # 5 % chance each frame
            self._last_event_code = _rng.choice(list(EVENT_CODES.keys()))

        # Build raw register values (integer-scaled per OBIS_MAPPING)
        registers: Dict[str, Any] = {
            "1-0:1.8.0":  round(self._energy_import_kwh / 0.001),
            "1-0:2.8.0":  round(self._energy_export_kwh / 0.001),
            "1-0:32.7.0": round(voltage_l1 / 0.1),
            "1-0:52.7.0": round(voltage_l2 / 0.1),
            "1-0:72.7.0": round(voltage_l3 / 0.1),
            "1-0:31.7.0": round(current_l1 / 0.01),
            "1-0:51.7.0": round(current_l2 / 0.01),
            "1-0:71.7.0": round(current_l3 / 0.01),
            "1-0:1.7.0":  round(power_w),
            "1-0:14.7.0": round(frequency / 0.01),
            "1-0:13.7.0": round(pf / 0.001),
            "0-0:96.1.0": self.meter_id,
            "0-0:1.0.0":  now.isoformat(),
            "0-0:96.8.0": self._operating_time_s,
            "0-0:96.7.0": self._last_event_code,
            "1-0:0.8.0":  round(self._peak_demand_w),
        }

        # Also provide human-readable scaled values for convenience
        scaled: Dict[str, Any] = {}
        for obis, raw in registers.items():
            info = OBIS_MAPPING.get(obis)
            if info and isinstance(raw, (int, float)):
                scaled[info["name"]] = round(raw * info["scaler"], 4)
            elif info:
                scaled[info["name"]] = raw

        event_log = self.generate_event_log(n_events=_rng.randint(0, 3))

        return {
            "meter_id": self.meter_id,
            "timestamp": now.isoformat(),
            "protocol": "DLMS/COSEM",
            "standard": "IS15959",
            "registers": registers,
            "scaled_values": scaled,
            "event_log": event_log,
            "temperature": round(self._temperature, 2),
        }

    # ── Billing snapshot ─────────────────────────────────────────────────

    def generate_billing_snapshot(self) -> Dict[str, Any]:
        """Return a monthly billing snapshot.

        Includes peak demand, total energy, and per-zone TOU registers.
        """
        now = datetime.now(timezone.utc)
        self._billing_month += 1

        # Accumulate some TOU energy
        hours_month = 30 * 24
        avg_power_kw = self.base_load_kw * 0.55  # average load factor
        total_kwh = avg_power_kw * hours_month

        self._tou["zone1_peak"] += total_kwh * 0.25 + _noise(5)
        self._tou["zone2_off_peak"] += total_kwh * 0.35 + _noise(5)
        self._tou["zone3_shoulder"] += total_kwh * 0.20 + _noise(5)
        self._tou["zone4_night"] += total_kwh * 0.20 + _noise(5)

        snapshot = {
            "meter_id": self.meter_id,
            "snapshot_timestamp": now.isoformat(),
            "billing_period": f"Month-{self._billing_month}",
            "total_energy_import_kwh": round(self._energy_import_kwh, 3),
            "total_energy_export_kwh": round(self._energy_export_kwh, 3),
            "peak_demand_w": round(self._peak_demand_w, 1),
            "peak_demand_kva": round(self._peak_demand_w / (0.90 * 1000), 3),
            "tou_registers_kwh": {k: round(v, 3) for k, v in self._tou.items()},
            "power_factor_avg": round(0.92 + _noise(0.02), 3),
            "operating_time_s": self._operating_time_s,
            "tamper_count": _rng.randint(0, 3),
            "last_tamper_event": _rng.choice([
                "None",
                "Terminal Cover Open",
                "Magnetic Influence",
                "Current Reverse",
            ]),
        }

        # Reset peak demand for next billing period
        self._peak_demand_w = 0.0

        return snapshot

    # ── Event log ────────────────────────────────────────────────────────

    def generate_event_log(self, n_events: int = 5) -> List[Dict[str, Any]]:
        """Generate a list of recent meter events.

        Parameters
        ----------
        n_events:
            Number of events to return (0–25).

        Returns
        -------
        list[dict]
            Each entry has ``timestamp``, ``event_code``, ``event_name``,
            ``severity``, and ``category``.
        """
        if n_events <= 0:
            return []

        n_events = min(n_events, 25)
        now = datetime.now(timezone.utc)
        events: List[Dict[str, Any]] = []

        for i in range(n_events):
            code = _rng.choice(list(EVENT_CODES.keys()))
            ev = EVENT_CODES[code]
            ts = now - timedelta(seconds=_rng.randint(60, 86400))
            events.append({
                "timestamp": ts.isoformat(),
                "event_code": code,
                "event_name": ev["name"],
                "severity": ev["severity"],
                "category": ev["category"],
            })

        # Sort by timestamp descending (most recent first)
        events.sort(key=lambda e: e["timestamp"], reverse=True)
        return events


# ── HESSimulator (Head-End System) ───────────────────────────────────────────


class HESSimulator:
    """Simulates a Head-End System that forwards DLMS frames to the backend.

    In a real deployment, the HES collects data from meters over RF-mesh,
    GPRS, NB-IoT, or LoRa and pushes to the MDMS/analytics platform.
    Here we simply POST to the Pro-Vigil REST API.

    Parameters
    ----------
    api_base_url:
        Base URL of the ProVigil backend (e.g. ``http://localhost:8000``).
    timeout:
        HTTP request timeout in seconds.
    """

    def __init__(
        self,
        api_base_url: str = "http://localhost:8000",
        timeout: float = 10.0,
    ) -> None:
        self.api_base_url = api_base_url.rstrip("/")
        self.timeout = timeout
        self._session = requests.Session()
        self._session.headers["Content-Type"] = "application/json"

    def push_meter_data(self, meter_id: str, dlms_frame: Dict[str, Any]) -> bool:
        """POST a single DLMS push frame to ``/api/ingest/dlms``.

        Parameters
        ----------
        meter_id:
            The meter identifier (overrides any ``meter_id`` in frame).
        dlms_frame:
            Dictionary produced by :meth:`DLMSMeterSimulator.generate_push_frame`.

        Returns
        -------
        bool
            ``True`` on successful ingestion, ``False`` otherwise.
        """
        url = f"{self.api_base_url}/api/ingest/dlms"

        payload = {
            "meter_id": meter_id,
            "timestamp": dlms_frame.get("timestamp"),
            "registers": dlms_frame.get("registers", {}),
        }

        try:
            resp = self._session.post(
                url,
                data=json.dumps(payload, default=str),
                timeout=self.timeout,
            )
            if resp.status_code in (200, 201):
                logger.info("Pushed DLMS frame for %s — OK", meter_id)
                return True
            else:
                logger.warning(
                    "DLMS push for %s returned %s: %s",
                    meter_id,
                    resp.status_code,
                    resp.text[:200],
                )
                return False
        except requests.RequestException as exc:
            logger.error("DLMS push failed for %s: %s", meter_id, exc)
            return False

    def push_bulk_data(
        self,
        meter_data_list: List[Dict[str, Any]],
    ) -> Dict[str, int]:
        """Push multiple DLMS frames sequentially.

        Parameters
        ----------
        meter_data_list:
            List of ``{"meter_id": ..., "frame": ...}`` dicts.

        Returns
        -------
        dict
            ``{"success": N, "failed": M}`` summary.
        """
        results = {"success": 0, "failed": 0}
        for entry in meter_data_list:
            mid = entry["meter_id"]
            frame = entry["frame"]
            ok = self.push_meter_data(mid, frame)
            results["success" if ok else "failed"] += 1
        return results

    def simulate_mdas_poll(
        self,
        meter_ids: List[str],
        interval_seconds: float = 900,
        base_load_range: tuple = (1.0, 5.0),
    ) -> None:
        """Run a continuous MDAS-style polling loop.

        Creates a :class:`DLMSMeterSimulator` for each meter and pushes data
        to the backend at the specified interval.  Runs forever (Ctrl-C to
        stop).

        Parameters
        ----------
        meter_ids:
            List of meter identifiers to simulate.
        interval_seconds:
            Seconds between successive polls.
        base_load_range:
            ``(min_kw, max_kw)`` for randomising each meter's base load.
        """
        simulators = {
            mid: DLMSMeterSimulator(
                meter_id=mid,
                base_load_kw=_rng.uniform(*base_load_range),
            )
            for mid in meter_ids
        }

        logger.info(
            "Starting MDAS poll simulation: %d meters, interval=%ds",
            len(meter_ids),
            interval_seconds,
        )

        cycle = 0
        while True:
            cycle += 1
            logger.info("── MDAS poll cycle %d ──", cycle)
            bulk: List[Dict[str, Any]] = []

            for mid, sim in simulators.items():
                frame = sim.generate_push_frame()
                bulk.append({"meter_id": mid, "frame": frame})

            result = self.push_bulk_data(bulk)
            logger.info(
                "Cycle %d complete: %d success, %d failed",
                cycle,
                result["success"],
                result["failed"],
            )

            try:
                time.sleep(interval_seconds)
            except KeyboardInterrupt:
                logger.info("MDAS poll stopped by user.")
                break


# ── CLI entry point ──────────────────────────────────────────────────────────


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "DLMS/COSEM Meter Simulator for ProVigil — generates IS 15959 "
            "compliant push frames and forwards them to the backend."
        ),
    )
    parser.add_argument(
        "--meters",
        type=int,
        default=10,
        help="Number of meters to simulate (default: 10).",
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=30,
        help=(
            "Push interval in seconds (default: 30 for demo; "
            "use 900 for realistic MDAS polling)."
        ),
    )
    parser.add_argument(
        "--api-url",
        type=str,
        default="http://localhost:8000",
        help="ProVigil backend base URL (default: http://localhost:8000).",
    )
    parser.add_argument(
        "--base-load-min",
        type=float,
        default=1.0,
        help="Minimum base load in kW (default: 1.0).",
    )
    parser.add_argument(
        "--base-load-max",
        type=float,
        default=5.0,
        help="Maximum base load in kW (default: 5.0).",
    )
    parser.add_argument(
        "--log-level",
        type=str,
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Logging verbosity (default: INFO).",
    )
    parser.add_argument(
        "--single-shot",
        action="store_true",
        help="Generate and push one frame per meter then exit (for testing).",
    )
    return parser


def main() -> None:
    """CLI entry point for the DLMS adapter simulator."""
    parser = _build_parser()
    args = parser.parse_args()

    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
        datefmt="%H:%M:%S",
    )

    meter_ids = [f"M-DLMS-{i:03d}" for i in range(1, args.meters + 1)]
    logger.info("Simulating %d DLMS meters", len(meter_ids))
    logger.info("Backend URL: %s", args.api_url)
    logger.info("Interval: %.0f s", args.interval)

    hes = HESSimulator(api_base_url=args.api_url)

    if args.single_shot:
        # One-off: generate and push a single frame per meter
        for mid in meter_ids:
            sim = DLMSMeterSimulator(
                meter_id=mid,
                base_load_kw=_rng.uniform(args.base_load_min, args.base_load_max),
            )
            frame = sim.generate_push_frame()
            print(json.dumps(frame, indent=2, default=str))
            hes.push_meter_data(mid, frame)
        logger.info("Single-shot complete.")
        return

    # Continuous polling loop
    hes.simulate_mdas_poll(
        meter_ids=meter_ids,
        interval_seconds=args.interval,
        base_load_range=(args.base_load_min, args.base_load_max),
    )


if __name__ == "__main__":
    main()
