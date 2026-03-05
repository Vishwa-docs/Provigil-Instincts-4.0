"""Router for telemetry ingestion endpoints."""

import json
import logging
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.schemas import Meter, Reading
from app.models.pydantic_models import TelemetryIngest
from app.utils.dlms_mapper import translate_dlms_to_internal

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ingest", tags=["ingest"])


def _upsert_meter(db: Session, meter_id: str) -> Meter:
    """Return the meter row, creating a stub if it doesn't exist yet."""
    meter = db.query(Meter).filter(Meter.id == meter_id).first()
    if not meter:
        meter = Meter(
            id=meter_id,
            name=f"Meter-{meter_id}",
            status="healthy",
            health_score=1.0,
        )
        db.add(meter)
        db.flush()
    return meter


def _store_reading(db: Session, data: TelemetryIngest) -> Reading:
    """Create a Reading row from ingest data and update the meter's last_seen."""
    meter = _upsert_meter(db, data.meter_id)
    meter.last_seen = data.timestamp or datetime.now(timezone.utc)

    reading = Reading(
        meter_id=data.meter_id,
        timestamp=data.timestamp or datetime.now(timezone.utc),
        voltage=data.voltage,
        current=data.current,
        power=data.power,
        energy_import=data.energy_import,
        temperature=data.temperature,
        frequency=data.frequency,
        power_factor=data.power_factor,
        local_alert=data.local_alert,
    )
    if data.raw_data:
        reading.set_raw_data(data.raw_data)

    db.add(reading)
    return reading


# ── REST endpoints ────────────────────────────────────────────────────────────


@router.post("/telemetry", status_code=201)
def ingest_telemetry(body: TelemetryIngest, db: Session = Depends(get_db)):
    """Accept a single telemetry reading."""
    reading = _store_reading(db, body)
    db.commit()
    db.refresh(reading)
    return {"status": "ok", "reading_id": reading.id}


@router.post("/telemetry/batch", status_code=201)
def ingest_telemetry_batch(body: List[TelemetryIngest], db: Session = Depends(get_db)):
    """Accept a batch of telemetry readings."""
    ids: list[int] = []
    for item in body:
        reading = _store_reading(db, item)
        db.flush()
        ids.append(reading.id)
    db.commit()
    return {"status": "ok", "count": len(ids), "reading_ids": ids}


@router.post("/dlms", status_code=201)
def ingest_dlms(body: dict, db: Session = Depends(get_db)):
    """Accept DLMS/COSEM formatted data (JSON with OBIS codes).

    Expected payload structure::

        {
            "meter_id": "M-001",
            "timestamp": "2026-02-28T12:00:00Z",   // optional
            "registers": {
                "1-0:32.7.0": 230.1,
                "1-0:31.7.0": 4.5,
                ...
            }
        }
    """
    meter_id = body.get("meter_id")
    if not meter_id:
        raise HTTPException(status_code=400, detail="meter_id is required")

    registers = body.get("registers")
    if not isinstance(registers, dict):
        raise HTTPException(status_code=400, detail="'registers' must be a dict of OBIS-code → value")

    # Translate OBIS codes → internal field names
    internal = translate_dlms_to_internal(registers)

    timestamp_raw = body.get("timestamp")
    ts = None
    if timestamp_raw:
        try:
            ts = datetime.fromisoformat(str(timestamp_raw).replace("Z", "+00:00"))
        except ValueError:
            ts = datetime.now(timezone.utc)

    ingest = TelemetryIngest(
        meter_id=meter_id,
        timestamp=ts,
        voltage=internal.get("voltage"),
        current=internal.get("current"),
        power=internal.get("power"),
        energy_import=internal.get("energy_import"),
        temperature=internal.get("temperature"),
        frequency=internal.get("frequency"),
        power_factor=internal.get("power_factor"),
        local_alert=False,
        raw_data=registers,  # keep original OBIS-keyed payload
    )

    reading = _store_reading(db, ingest)
    db.commit()
    db.refresh(reading)
    return {"status": "ok", "reading_id": reading.id, "translated_fields": list(internal.keys())}
