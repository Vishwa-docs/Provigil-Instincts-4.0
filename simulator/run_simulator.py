#!/usr/bin/env python3
"""
ProVigil Instincts — Meter Fleet Simulator

Main entry point that drives a simulated fleet of smart meters,
generating realistic telemetry (with optional fault injection) and
publishing it via MQTT, the REST API, or both.

Usage examples
--------------
    # 10 demo meters at 60× speed via API for 2 simulated hours
    python run_simulator.py --meters demo --speed 60 --duration 2 --mode api

    # 50 random meters at real-time via MQTT
    python run_simulator.py --meters 50 --speed 1 --duration 24 --mode mqtt

    # Both channels, 10× speed, 30-s reading interval
    python run_simulator.py --mode both --speed 10 --interval 30
"""

import argparse
import logging
import signal
import sys
import time
from datetime import datetime, timedelta
from typing import List, Optional

from simulator.meter_profiles import MeterProfile, generate_meter_fleet, get_demo_meters
from simulator.signal_generators import (
    generate_normal_load,
    inject_battery_fault,
    inject_comm_loss,
    inject_consumption_anomaly,
    inject_loose_terminal,
    inject_sensor_fault,
)
from simulator.mqtt_publisher import MQTTPublisher
from simulator.api_publisher import APIPublisher

# ------------------------------------------------------------------
# Logging
# ------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("simulator")

# ------------------------------------------------------------------
# Fault dispatcher
# ------------------------------------------------------------------

_INJECTORS = {
    "loose_terminal": inject_loose_terminal,
    "comm_loss": inject_comm_loss,
    "sensor_fault": inject_sensor_fault,
    "battery_fault": inject_battery_fault,
    "consumption_anomaly": inject_consumption_anomaly,
}

# ------------------------------------------------------------------
# Graceful-shutdown flag
# ------------------------------------------------------------------

_shutdown = False


def _signal_handler(signum, frame):
    global _shutdown
    _shutdown = True
    logger.info("Shutdown signal received — finishing current cycle …")


signal.signal(signal.SIGINT, _signal_handler)
signal.signal(signal.SIGTERM, _signal_handler)

# ------------------------------------------------------------------
# CLI
# ------------------------------------------------------------------


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="ProVigil smart-meter fleet simulator",
    )
    parser.add_argument(
        "--mode",
        choices=["mqtt", "api", "both"],
        default="api",
        help="Publishing channel (default: api)",
    )
    parser.add_argument(
        "--meters",
        default="demo",
        help=(
            'Number of meters to simulate, or "demo" for the curated '
            "10-meter demo set (default: demo)"
        ),
    )
    parser.add_argument(
        "--speed",
        type=float,
        default=60.0,
        help="Simulation speed multiplier (default: 60 → 1 real sec = 1 sim min)",
    )
    parser.add_argument(
        "--duration",
        type=float,
        default=2.0,
        help="Simulated hours to run (default: 2)",
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=30.0,
        help="Simulated seconds between readings per meter (default: 30)",
    )
    parser.add_argument(
        "--mqtt-host",
        default="localhost",
        help="MQTT broker host (default: localhost)",
    )
    parser.add_argument(
        "--mqtt-port",
        type=int,
        default=1883,
        help="MQTT broker port (default: 1883)",
    )
    parser.add_argument(
        "--api-url",
        default="http://localhost:8000",
        help="Backend API base URL (default: http://localhost:8000)",
    )
    return parser.parse_args()


# ------------------------------------------------------------------
# Core simulation
# ------------------------------------------------------------------


def build_reading(
    meter: MeterProfile,
    sim_time: datetime,
    sim_elapsed_hours: float,
) -> Optional[dict]:
    """
    Generate a telemetry dict for *meter* at the given simulated time.

    Returns None when a comm-loss scenario drops the reading.
    """
    reading = generate_normal_load(sim_time, meter.base_load_kw, meter.meter_type)

    # Inject faults if applicable
    if meter.failure_scenario and meter.failure_start_hour is not None:
        hours_since_fault = sim_elapsed_hours - meter.failure_start_hour
        if hours_since_fault > 0:
            # Map fault duration to 0-1 progress over ~2 hours
            fault_duration_hours = 2.0
            progress = min(hours_since_fault / fault_duration_hours, 1.0)

            injector = _INJECTORS.get(meter.failure_scenario)
            if injector:
                reading = injector(reading, progress)
                # inject_comm_loss may return None
                if reading is None:
                    return None

    # Envelope
    reading["meter_id"] = meter.meter_id
    reading["timestamp"] = sim_time.isoformat()

    return reading


def run(args: argparse.Namespace) -> None:
    """Main simulation loop."""

    # ---- Meter fleet ----
    if args.meters == "demo":
        fleet = get_demo_meters()
    else:
        fleet = generate_meter_fleet(n_meters=int(args.meters))

    logger.info(
        "Fleet: %d meters  |  mode=%s  |  speed=%.0f×  |  duration=%.1f h  |  interval=%.0f s",
        len(fleet),
        args.mode,
        args.speed,
        args.duration,
        args.interval,
    )

    # ---- Publishers ----
    mqtt_pub: Optional[MQTTPublisher] = None
    api_pub: Optional[APIPublisher] = None

    if args.mode in ("mqtt", "both"):
        mqtt_pub = MQTTPublisher(host=args.mqtt_host, port=args.mqtt_port)
        mqtt_pub.connect()

    if args.mode in ("api", "both"):
        api_pub = APIPublisher(base_url=args.api_url)

    # ---- Time bookkeeping ----
    sim_start = datetime.utcnow()
    sim_time = sim_start
    sim_end = sim_start + timedelta(hours=args.duration)
    sim_interval = timedelta(seconds=args.interval)
    real_sleep = args.interval / args.speed  # seconds to sleep in wall-clock time

    total_sent = 0
    total_dropped = 0
    last_status = time.time()

    logger.info(
        "Simulation window: %s  →  %s  (wall-clock sleep per tick: %.3f s)",
        sim_start.strftime("%H:%M:%S"),
        sim_end.strftime("%H:%M:%S"),
        real_sleep,
    )

    # ---- Main loop ----
    try:
        while sim_time < sim_end and not _shutdown:
            elapsed_hours = (sim_time - sim_start).total_seconds() / 3600.0
            batch: List[dict] = []

            for meter in fleet:
                reading = build_reading(meter, sim_time, elapsed_hours)
                if reading is None:
                    total_dropped += 1
                    continue

                batch.append(reading)

                # MQTT publishes one-by-one
                if mqtt_pub:
                    mqtt_pub.publish_telemetry(meter.meter_id, reading)

            # API batch publish
            if api_pub and batch:
                api_pub.send_batch(batch)

            total_sent += len(batch)

            # Status printout roughly every 60 wall-clock seconds
            now = time.time()
            if now - last_status >= 60.0 or sim_time == sim_start:
                logger.info(
                    "[SIM %s]  elapsed=%.1f h  |  sent=%d  dropped=%d",
                    sim_time.strftime("%H:%M:%S"),
                    elapsed_hours,
                    total_sent,
                    total_dropped,
                )
                last_status = now

            # Advance simulated clock
            sim_time += sim_interval

            # Sleep wall-clock time (interruptible)
            if not _shutdown:
                time.sleep(real_sleep)

    finally:
        logger.info(
            "Simulation ended.  Total readings sent: %d  |  dropped: %d",
            total_sent,
            total_dropped,
        )
        if mqtt_pub:
            mqtt_pub.disconnect()
        if api_pub:
            api_pub.close()


# ------------------------------------------------------------------
# Entry point
# ------------------------------------------------------------------

def main() -> None:
    args = parse_args()
    run(args)


if __name__ == "__main__":
    main()
