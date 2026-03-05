#!/usr/bin/env python3
"""
ProVigil Instincts — Scenario Runner

Runs pre-defined demo scenarios that are useful for live demonstrations
and testing.  Each scenario sends data via the REST API for simplicity.

Usage
-----
    python scenario_runner.py --scenario loose_terminal
    python scenario_runner.py --scenario dead_meter
    python scenario_runner.py --scenario consumption_anomaly
    python scenario_runner.py --scenario full_demo

    # Optional flags
    --api-url http://localhost:8000
    --speed   60          # simulation speed multiplier
    --interval 30         # simulated seconds between readings
"""

import argparse
import logging
import signal
import sys
import time
from datetime import datetime, timedelta
from typing import List, Optional

from simulator.meter_profiles import MeterProfile, get_demo_meters
from simulator.signal_generators import (
    generate_normal_load,
    inject_comm_loss,
    inject_consumption_anomaly,
    inject_loose_terminal,
)
from simulator.api_publisher import APIPublisher

# ------------------------------------------------------------------
# Logging
# ------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("scenario")

# ------------------------------------------------------------------
# Graceful shutdown
# ------------------------------------------------------------------

_shutdown = False


def _signal_handler(signum, frame):
    global _shutdown
    _shutdown = True
    logger.info("Shutdown requested …")


signal.signal(signal.SIGINT, _signal_handler)
signal.signal(signal.SIGTERM, _signal_handler)

# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------


def _run_scenario_loop(
    meters: List[MeterProfile],
    api: APIPublisher,
    duration_hours: float,
    speed: float,
    interval_sec: float,
    label: str,
) -> None:
    """
    Generic simulation loop shared by all scenarios.

    Parameters
    ----------
    meters : list[MeterProfile]
        The meters to simulate (may include fault configs).
    api : APIPublisher
        REST publisher.
    duration_hours : float
        Simulated duration.
    speed : float
        Speed multiplier.
    interval_sec : float
        Simulated seconds between readings.
    label : str
        Human-readable scenario name for log output.
    """
    sim_start = datetime.utcnow()
    sim_time = sim_start
    sim_end = sim_start + timedelta(hours=duration_hours)
    sim_interval = timedelta(seconds=interval_sec)
    real_sleep = interval_sec / speed

    total_sent = 0
    total_dropped = 0
    last_log = time.time()

    logger.info(
        "=== Scenario [%s] started ===  meters=%d  duration=%.1f h  speed=%.0f×",
        label,
        len(meters),
        duration_hours,
        speed,
    )

    _INJECTORS = {
        "loose_terminal": inject_loose_terminal,
        "comm_loss": inject_comm_loss,
        "consumption_anomaly": inject_consumption_anomaly,
    }

    try:
        while sim_time < sim_end and not _shutdown:
            elapsed_h = (sim_time - sim_start).total_seconds() / 3600.0
            batch: List[dict] = []

            for meter in meters:
                reading = generate_normal_load(
                    sim_time, meter.base_load_kw, meter.meter_type
                )

                if meter.failure_scenario and meter.failure_start_hour is not None:
                    hours_since = elapsed_h - meter.failure_start_hour
                    if hours_since > 0:
                        progress = min(hours_since / 2.0, 1.0)
                        injector = _INJECTORS.get(meter.failure_scenario)
                        if injector:
                            reading = injector(reading, progress)
                            if reading is None:
                                total_dropped += 1
                                continue

                reading["meter_id"] = meter.meter_id
                reading["timestamp"] = sim_time.isoformat()
                batch.append(reading)

            if batch:
                api.send_batch(batch)
                total_sent += len(batch)

            # Log every ~30 wall-clock seconds
            now = time.time()
            if now - last_log >= 30.0:
                logger.info(
                    "[%s]  sim=%s  elapsed=%.2f h  sent=%d  dropped=%d",
                    label,
                    sim_time.strftime("%H:%M:%S"),
                    elapsed_h,
                    total_sent,
                    total_dropped,
                )
                last_log = now

            sim_time += sim_interval
            if not _shutdown:
                time.sleep(real_sleep)

    finally:
        logger.info(
            "=== Scenario [%s] ended ===  total_sent=%d  total_dropped=%d",
            label,
            total_sent,
            total_dropped,
        )


# ------------------------------------------------------------------
# Individual scenarios
# ------------------------------------------------------------------


def scenario_loose_terminal(api: APIPublisher, speed: float, interval: float) -> None:
    """
    One residential meter gradually develops a loose terminal connection
    over 2 simulated hours.  A healthy reference meter runs alongside.
    """
    meters = [
        MeterProfile(
            meter_id="MTR-SC01",
            name="Healthy Reference",
            location_lat=28.6139,
            location_lng=77.2090,
            base_load_kw=2.0,
            meter_type="residential",
        ),
        MeterProfile(
            meter_id="MTR-SC02",
            name="Loose Terminal Subject",
            location_lat=28.6200,
            location_lng=77.2300,
            base_load_kw=2.0,
            meter_type="residential",
            failure_scenario="loose_terminal",
            failure_start_hour=0.1,
        ),
    ]
    _run_scenario_loop(meters, api, duration_hours=2.0, speed=speed,
                       interval_sec=interval, label="loose_terminal")


def scenario_dead_meter(api: APIPublisher, speed: float, interval: float) -> None:
    """
    One commercial meter progressively loses communication and eventually
    goes completely silent.
    """
    meters = [
        MeterProfile(
            meter_id="MTR-SC03",
            name="Healthy Commercial Ref",
            location_lat=28.6280,
            location_lng=77.2180,
            base_load_kw=10.0,
            meter_type="commercial",
        ),
        MeterProfile(
            meter_id="MTR-SC04",
            name="Dying Comm Meter",
            location_lat=28.6000,
            location_lng=77.2000,
            base_load_kw=8.0,
            meter_type="commercial",
            failure_scenario="comm_loss",
            failure_start_hour=0.15,
        ),
    ]
    _run_scenario_loop(meters, api, duration_hours=2.0, speed=speed,
                       interval_sec=interval, label="dead_meter")


def scenario_consumption_anomaly(api: APIPublisher, speed: float, interval: float) -> None:
    """
    One residential meter shows suspicious consumption patterns
    (possible theft or wiring tampering).
    """
    meters = [
        MeterProfile(
            meter_id="MTR-SC05",
            name="Normal Neighbor",
            location_lat=28.5900,
            location_lng=77.2500,
            base_load_kw=1.5,
            meter_type="residential",
        ),
        MeterProfile(
            meter_id="MTR-SC06",
            name="Anomalous Consumer",
            location_lat=28.5920,
            location_lng=77.2550,
            base_load_kw=1.5,
            meter_type="residential",
            failure_scenario="consumption_anomaly",
            failure_start_hour=0.1,
        ),
    ]
    _run_scenario_loop(meters, api, duration_hours=2.0, speed=speed,
                       interval_sec=interval, label="consumption_anomaly")


def scenario_full_demo(api: APIPublisher, speed: float, interval: float) -> None:
    """
    Run a complete demo with 10 meters: 7 healthy + 3 failing
    (loose terminal, comm loss, consumption anomaly).
    """
    demo_meters = get_demo_meters()
    # get_demo_meters returns exactly 10: 7 healthy + 3 faulty
    _run_scenario_loop(demo_meters, api, duration_hours=2.0, speed=speed,
                       interval_sec=interval, label="full_demo")


# ------------------------------------------------------------------
# CLI
# ------------------------------------------------------------------

SCENARIOS = {
    "loose_terminal": scenario_loose_terminal,
    "dead_meter": scenario_dead_meter,
    "consumption_anomaly": scenario_consumption_anomaly,
    "full_demo": scenario_full_demo,
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="ProVigil scenario runner — pre-built demo scenarios",
    )
    parser.add_argument(
        "--scenario",
        choices=list(SCENARIOS.keys()),
        required=True,
        help="Scenario to run",
    )
    parser.add_argument(
        "--api-url",
        default="http://localhost:8000",
        help="Backend API base URL (default: http://localhost:8000)",
    )
    parser.add_argument(
        "--speed",
        type=float,
        default=60.0,
        help="Simulation speed multiplier (default: 60)",
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=30.0,
        help="Simulated seconds between readings (default: 30)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    api = APIPublisher(base_url=args.api_url)
    try:
        scenario_fn = SCENARIOS[args.scenario]
        scenario_fn(api, speed=args.speed, interval=args.interval)
    finally:
        api.close()


if __name__ == "__main__":
    main()
