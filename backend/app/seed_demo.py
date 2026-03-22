"""Initial fleet data seeder — populates DB with meter fleet, telemetry, network topology, alerts, and work orders."""

import json
import logging
import math
import random
from datetime import datetime, timedelta, timezone

from app.database import SessionLocal
from app.models.schemas import Alert, Anomaly, Meter, NetworkNode, Reading, WorkOrder

logger = logging.getLogger(__name__)

# Fleet region center coordinates
FLEET_CENTER = (28.6139, 77.2090)


def _generate_load_curve(hour: int, meter_type: str) -> float:
    """Time-of-day load multiplier."""
    if meter_type == "residential":
        curve = [0.3, 0.25, 0.2, 0.2, 0.2, 0.25, 0.4, 0.6, 0.5, 0.4, 0.35, 0.35,
                 0.4, 0.35, 0.35, 0.4, 0.5, 0.7, 0.9, 1.0, 0.9, 0.7, 0.5, 0.35]
    elif meter_type == "commercial":
        curve = [0.2, 0.15, 0.15, 0.15, 0.15, 0.2, 0.3, 0.5, 0.8, 0.9, 1.0, 1.0,
                 0.9, 0.95, 1.0, 0.95, 0.9, 0.7, 0.4, 0.3, 0.25, 0.2, 0.2, 0.2]
    else:  # industrial
        curve = [0.7, 0.7, 0.7, 0.7, 0.7, 0.75, 0.85, 0.9, 1.0, 1.0, 1.0, 0.95,
                 0.9, 1.0, 1.0, 1.0, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.7, 0.7]
    return curve[hour % 24]


METERS = [
    {"id": "MTR-001", "name": "SM-001 Grid Alpha", "type": "residential", "base_power": 1800,
     "lat": 28.5244, "lng": 77.2167, "issue": None, "health": 0.95},
    {"id": "MTR-002", "name": "SM-002 Grid Beta", "type": "residential", "base_power": 2200,
     "lat": 28.5921, "lng": 77.0460, "issue": None, "health": 0.92},
    {"id": "MTR-003", "name": "SM-003 Commercial Hub", "type": "commercial", "base_power": 12000,
     "lat": 28.5491, "lng": 77.2533, "issue": None, "health": 0.88},
    {"id": "MTR-004", "name": "SM-004 Industrial Zone", "type": "industrial", "base_power": 85000,
     "lat": 28.5310, "lng": 77.2710, "issue": None, "health": 0.91},
    {"id": "MTR-005", "name": "SM-005 Grid Gamma", "type": "residential", "base_power": 1500,
     "lat": 28.7380, "lng": 77.1125, "issue": None, "health": 0.97},
    {"id": "MTR-006", "name": "SM-006 Retail Cluster", "type": "commercial", "base_power": 8000,
     "lat": 28.6315, "lng": 77.2167, "issue": None, "health": 0.90},
    {"id": "MTR-007", "name": "SM-007 Grid Delta", "type": "residential", "base_power": 2500,
     "lat": 28.5197, "lng": 77.1540, "issue": None, "health": 0.93},
    # Meters with known fault conditions
    {"id": "MTR-008", "name": "SM-008 Feeder A3", "type": "commercial", "base_power": 9000,
     "lat": 28.5700, "lng": 77.2400, "issue": "Thermal Stress \u2014 Loose Terminal", "health": 0.28},
    {"id": "MTR-009", "name": "SM-009 Feeder B1", "type": "residential", "base_power": 1900,
     "lat": 28.6100, "lng": 77.3000, "issue": "Communication Loss", "health": 0.15},
    {"id": "MTR-010", "name": "SM-010 Industrial Spur", "type": "industrial", "base_power": 95000,
     "lat": 28.6313, "lng": 77.1422, "issue": "Voltage Sag Anomaly", "health": 0.42},
]

TRANSFORMERS = [
    {"id": "TRF-001", "name": "DT-001 Zone South", "parent": "FDR-001", "lat": 28.5280, "lng": 77.2200,
     "meters": ["MTR-001", "MTR-008"]},
    {"id": "TRF-002", "name": "DT-002 Zone West", "parent": "FDR-001", "lat": 28.5950, "lng": 77.0500,
     "meters": ["MTR-002", "MTR-007"]},
    {"id": "TRF-003", "name": "DT-003 Zone Central", "parent": "FDR-002", "lat": 28.5500, "lng": 77.2560,
     "meters": ["MTR-003", "MTR-004"]},
    {"id": "TRF-004", "name": "DT-004 Zone North", "parent": "FDR-002", "lat": 28.7350, "lng": 77.1150,
     "meters": ["MTR-005", "MTR-006", "MTR-009", "MTR-010"]},
]

FEEDERS = [
    {"id": "FDR-001", "name": "Feeder Alpha 33kV", "lat": 28.5500, "lng": 77.1500},
    {"id": "FDR-002", "name": "Feeder Beta 33kV", "lat": 28.6500, "lng": 77.2000},
]


def seed_initial_data() -> None:
    """Populate database with initial fleet data if it's empty."""
    db = SessionLocal()
    try:
        existing = db.query(Meter).count()
        if existing > 0:
            logger.info("Database already has %d meters — skipping seed.", existing)
            return

        logger.info("Seeding initial fleet data …")
        now = datetime.now(timezone.utc)

        # ── Network topology ─────────────────────────────────────────────
        for f in FEEDERS:
            db.add(NetworkNode(
                id=f["id"], node_type="feeder", name=f["name"],
                location_lat=f["lat"], location_lng=f["lng"],
            ))

        for t in TRANSFORMERS:
            db.add(NetworkNode(
                id=t["id"], node_type="transformer", name=t["name"],
                parent_id=t["parent"],
                location_lat=t["lat"], location_lng=t["lng"],
            ))

        # Create meter network nodes (links meters to transformers)
        for t in TRANSFORMERS:
            for meter_id in t["meters"]:
                meter_cfg = next(m for m in METERS if m["id"] == meter_id)
                db.add(NetworkNode(
                    id=meter_id, node_type="meter", name=meter_cfg["name"],
                    parent_id=t["id"],
                    location_lat=meter_cfg["lat"], location_lng=meter_cfg["lng"],
                ))

        # ── Meters ────────────────────────────────────────────────────────
        for m in METERS:
            status = "healthy"
            if m["health"] < 0.35:
                status = "critical"
            elif m["health"] < 0.7:
                status = "warning"

            meter = Meter(
                id=m["id"],
                name=m["name"],
                location_lat=m["lat"],
                location_lng=m["lng"],
                install_date=now - timedelta(days=random.randint(180, 730)),
                status=status,
                health_score=m["health"],
                last_seen=now - timedelta(minutes=random.randint(1, 30)),
                suspected_issue=m["issue"],
            )
            db.add(meter)

        db.flush()

        # ── Readings (72 hours of data, every 30 minutes) ────────────────
        hours_back = 72
        readings_per_hour = 2  # every 30 min
        total_readings = hours_back * readings_per_hour

        for m in METERS:
            energy_acc = random.uniform(1000, 5000)
            for i in range(total_readings):
                ts = now - timedelta(minutes=(total_readings - i) * 30)
                hour = ts.hour
                load_mult = _generate_load_curve(hour, m["type"])

                power = m["base_power"] * load_mult * random.uniform(0.9, 1.1)
                voltage = 230 + random.gauss(0, 3)
                pf = 0.92 + random.gauss(0, 0.02)
                current = power / (voltage * max(pf, 0.1))
                temp = 30 + (power / m["base_power"]) * 8 + random.gauss(0, 1)
                freq = 50 + random.gauss(0, 0.15)
                energy_acc += power * 0.5 / 1000  # 30min in kWh

                # New telemetry fields — baseline values
                thd_base = {"residential": 1.8, "commercial": 2.5, "industrial": 3.5}
                thd_val = thd_base.get(m["type"], 2.0) + random.gauss(0, 0.5)
                chatter_val = 4.0 + random.gauss(0, 1.5)  # normal: 2-8 ms
                batt_val = 3.15 + random.gauss(0, 0.05)    # normal: 3.0-3.3V
                harm_val = 0.02 + random.gauss(0, 0.005)   # normal: 0.01-0.03
                heap_val = 38.0 + random.gauss(0, 5.0)     # normal: 30-50%
                voc_val = 8.0 + random.gauss(0, 3.0)        # normal: 5-15 ppm

                # Inject anomaly patterns for faulty meters
                if m["issue"] == "Thermal Stress \u2014 Loose Terminal" and i > total_readings * 0.6:
                    progress = (i - total_readings * 0.6) / (total_readings * 0.4)
                    temp += progress * 30  # temperature rising
                    voltage -= progress * 15  # voltage drops
                    current += random.gauss(0, 2) * progress
                    thd_val += progress * 5  # THD rises with thermal stress
                    chatter_val += progress * 150  # relay contacts degrading
                    voc_val += progress * 120  # VOC rises with arcing/off-gassing

                elif m["issue"] == "Communication Loss" and i > total_readings * 0.8:
                    if random.random() < 0.7:
                        voltage = 0
                        current = 0
                        power = 0
                        temp = 25
                    batt_val -= 0.005  # battery draining during outages

                elif m["issue"] == "Voltage Sag Anomaly" and i > total_readings * 0.5:
                    progress = (i - total_readings * 0.5) / (total_readings * 0.5)
                    voltage -= progress * 40  # gradual voltage sag
                    # Occasional 300V+ spikes (floating neutral signature)
                    if random.random() < 0.05 * progress:
                        voltage = 310 + random.uniform(0, 30)

                reading = Reading(
                    meter_id=m["id"],
                    timestamp=ts,
                    voltage=round(max(voltage, 0), 2),
                    current=round(max(current, 0), 3),
                    power=round(max(power, 0), 1),
                    energy_import=round(energy_acc, 3),
                    temperature=round(temp, 1),
                    frequency=round(freq, 2),
                    power_factor=round(max(min(pf, 1.0), 0.5), 3),
                    thd=round(max(thd_val, 0.5), 2),
                    relay_chatter_ms=round(max(chatter_val, 1.0), 1),
                    battery_voltage=round(max(batt_val, 2.0), 3),
                    harmonic_distortion=round(max(harm_val, 0.005), 4),
                    firmware_heap_pct=round(max(min(heap_val, 99.0), 20.0), 1),
                    voc_ppm=round(max(voc_val, 1.0), 1),
                )
                db.add(reading)

        db.flush()

        # ── Alerts for faulty meters ──────────────────────────────────────
        alert_data = [
            {"meter_id": "MTR-008", "type": "anomaly", "severity": "critical",
             "message": "Anomaly detected on SM-008 Feeder A3: health score 28%, issue: Thermal Stress — Loose Terminal"},
            {"meter_id": "MTR-008", "type": "threshold", "severity": "critical",
             "message": "Temperature alert: 63.2°C at terminal with 8.5A load — I²R heating indicates loose connection. VOC gas level elevated."},
            {"meter_id": "MTR-009", "type": "anomaly", "severity": "critical",
             "message": "Anomaly detected on SM-009 Feeder B1: health score 15%, issue: Communication Loss"},
            {"meter_id": "MTR-009", "type": "comm_loss", "severity": "critical",
             "message": "Communication blackout: no telemetry received for 6+ hours"},
            {"meter_id": "MTR-010", "type": "anomaly", "severity": "warning",
             "message": "Anomaly detected on SM-010 Industrial Spur: health score 42%, issue: Voltage Sag Anomaly"},
            {"meter_id": "MTR-010", "type": "threshold", "severity": "warning",
             "message": "Sustained under-voltage condition: 198V (CEA nominal 230V ±10%) — possible transformer tap issue"},
            {"meter_id": "MTR-003", "type": "maintenance", "severity": "info",
             "message": "Scheduled maintenance reminder for SM-003 Commercial Hub — annual inspection due"},
            {"meter_id": "MTR-006", "type": "anomaly", "severity": "warning",
             "message": "Power factor degradation on SM-006 Retail Cluster: PF=0.78 — reactive power imbalance detected"},
        ]
        for i, a in enumerate(alert_data):
            alert = Alert(
                meter_id=a["meter_id"],
                alert_type=a["type"],
                severity=a["severity"],
                message=a["message"],
                acknowledged=i > 5,
                created_at=now - timedelta(hours=random.randint(1, 48)),
            )
            db.add(alert)

        # ── Anomalies ────────────────────────────────────────────────────
        anomaly_records = [
            {"meter_id": "MTR-008", "score": 0.72, "risk": "critical", "issue": "Thermal Stress \u2014 Loose Terminal",
             "factors": ["Thermal Stress \u2014 Loose Terminal: High temperature (63.2\u00b0C) with normal load (8.5A) indicates contact resistance buildup (score=0.51)",
                         "Voltage Sag Anomaly: Low voltage (215.3V) below CEA 207V limit (score=0.30)"]},
            {"meter_id": "MTR-009", "score": 0.80, "risk": "critical", "issue": "Communication Loss",
             "factors": ["Communication Loss: All readings zero \u2014 complete telemetry blackout (score=0.80)"]},
            {"meter_id": "MTR-010", "score": 0.58, "risk": "warning", "issue": "Voltage Sag Anomaly",
             "factors": ["Voltage Sag Anomaly: Low voltage (192.1V) below CEA 207V limit (score=0.16)",
                         "Poor Power Quality: Low power factor (0.76) \u2014 reactive power imbalance (score=0.08)"]},
        ]
        for ar in anomaly_records:
            anomaly = Anomaly(
                meter_id=ar["meter_id"],
                detected_at=now - timedelta(hours=random.randint(1, 12)),
                anomaly_score=ar["score"],
                risk_level=ar["risk"],
                suspected_issue=ar["issue"],
            )
            anomaly.set_contributing_factors(ar["factors"])
            db.add(anomaly)

        # ── Work Orders ───────────────────────────────────────────────────
        work_orders = [
            {"meter_id": "MTR-008", "priority": 1, "status": "scheduled",
             "issue_type": "Thermal Stress — Loose Terminal",
             "description": "URGENT: Terminal overheating detected at SM-008 Feeder A3 meter. Temperature readings show 63°C at L1 terminal with only 8.5A load — I²R heating strongly indicates loose screw connection. VOC gas sensor corroborates arcing presence. Risk of terminal fire. Dispatch crew with thermal imager and torque wrench.",
             "scheduled": now + timedelta(days=1)},
            {"meter_id": "MTR-009", "priority": 1, "status": "pending",
             "issue_type": "Communication Loss",
             "description": "Complete telemetry blackout from SM-009 Feeder B1 meter for 6+ hours. No response to remote ping. Could be power outage, comms module failure, or physical disconnection. Requires on-site visit to verify.",
             "scheduled": None},
            {"meter_id": "MTR-010", "priority": 2, "status": "in_progress",
             "issue_type": "Voltage Sag Anomaly",
             "description": "Sustained under-voltage at SM-010 Industrial Spur. Readings show 192V vs 230V nominal. Possible causes: overloaded transformer tap, degraded service connection. Cross-check with neighbor meters on same transformer.",
             "scheduled": now + timedelta(days=2)},
            {"meter_id": "MTR-003", "priority": 4, "status": "pending",
             "issue_type": "Annual Maintenance",
             "description": "Scheduled annual inspection for SM-003 Commercial Hub meter. Check calibration, inspect terminals, verify communication module, and update firmware if available.",
             "scheduled": now + timedelta(days=14)},
        ]
        for wo in work_orders:
            db.add(WorkOrder(
                meter_id=wo["meter_id"],
                priority=wo["priority"],
                status=wo["status"],
                issue_type=wo["issue_type"],
                description=wo["description"],
                scheduled_date=wo["scheduled"],
            ))

        db.commit()
        logger.info("Initial fleet data seeded: %d meters, %d readings, %d alerts, %d work orders.",
                     len(METERS), len(METERS) * total_readings, len(alert_data), len(work_orders))

    except Exception:
        db.rollback()
        logger.exception("Failed to seed fleet data.")
    finally:
        db.close()
