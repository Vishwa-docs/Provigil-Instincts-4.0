"""MQTT client service for receiving meter telemetry.

Connects to a Mosquitto (or any MQTT 3.1.1) broker aand subscribes to the
``pro-vigil/meter/+/telemetry`` topic.  Incoming JSON messages are parsed and
persisted as :class:`Reading` rows via the database session.

The service runs its network loop in a **background thread** so it does not
block the FastAPI event loop.
"""

import json
import logging
import threading
from datetime import datetime, timezone
from typing import Optional

import paho.mqtt.client as mqtt

from app.config import settings
from app.database import SessionLocal
from app.models.schemas import Meter, Reading

logger = logging.getLogger(__name__)

_client: Optional[mqtt.Client] = None
_thread: Optional[threading.Thread] = None


# ── MQTT callbacks ────────────────────────────────────────────────────────────


def _on_connect(client: mqtt.Client, userdata, flags, rc):
    if rc == 0:
        topic = f"{settings.MQTT_TOPIC_PREFIX}/+/telemetry"
        client.subscribe(topic)
        logger.info("MQTT connected – subscribed to %s", topic)
    else:
        logger.error("MQTT connection failed with code %s", rc)


def _on_message(client: mqtt.Client, userdata, msg: mqtt.MQTTMessage):
    """Handle an incoming telemetry message.

    Expected topic format: ``pro-vigil/meter/{meter_id}/telemetry``
    Expected payload: JSON with optional keys matching the Reading columns.
    """
    try:
        topic_parts = msg.topic.split("/")
        # topic_parts: ["pro-vigil", "meter", "<meter_id>", "telemetry"]
        if len(topic_parts) < 4:
            logger.warning("Unexpected MQTT topic format: %s", msg.topic)
            return

        meter_id = topic_parts[2]
        payload = json.loads(msg.payload.decode("utf-8"))

        _persist_reading(meter_id, payload)
    except json.JSONDecodeError:
        logger.warning("Non-JSON payload on %s", msg.topic)
    except Exception:
        logger.exception("Error processing MQTT message on %s", msg.topic)


def _on_disconnect(client: mqtt.Client, userdata, rc):
    if rc != 0:
        logger.warning("MQTT unexpected disconnect (rc=%s). Will auto-reconnect.", rc)


# ── Persistence helper ────────────────────────────────────────────────────────


def _persist_reading(meter_id: str, payload: dict) -> None:
    """Write a telemetry payload to the database."""
    db = SessionLocal()
    try:
        # Upsert meter stub if it doesn't exist
        meter = db.query(Meter).filter(Meter.id == meter_id).first()
        if not meter:
            meter = Meter(id=meter_id, name=f"Meter-{meter_id}", status="healthy", health_score=1.0)
            db.add(meter)
            db.flush()

        ts_raw = payload.get("timestamp")
        if ts_raw:
            try:
                ts = datetime.fromisoformat(str(ts_raw).replace("Z", "+00:00"))
            except ValueError:
                ts = datetime.now(timezone.utc)
        else:
            ts = datetime.now(timezone.utc)

        meter.last_seen = ts

        reading = Reading(
            meter_id=meter_id,
            timestamp=ts,
            voltage=payload.get("voltage"),
            current=payload.get("current"),
            power=payload.get("power"),
            energy_import=payload.get("energy_import"),
            temperature=payload.get("temperature"),
            frequency=payload.get("frequency"),
            power_factor=payload.get("power_factor"),
            local_alert=bool(payload.get("local_alert", False)),
        )
        raw = {k: v for k, v in payload.items() if k not in {"timestamp"}}
        if raw:
            reading.set_raw_data(raw)

        db.add(reading)
        db.commit()
        logger.debug("Stored reading for meter %s", meter_id)
    except Exception:
        db.rollback()
        logger.exception("Failed to persist MQTT reading for meter %s", meter_id)
    finally:
        db.close()


# ── Public API ────────────────────────────────────────────────────────────────


def start_mqtt() -> None:
    """Start the MQTT client in a background thread.

    Safe to call even when the broker is unreachable – the client will
    attempt to reconnect automatically.
    """
    global _client, _thread

    _client = mqtt.Client(client_id="provigil-backend", clean_session=True)
    _client.on_connect = _on_connect
    _client.on_message = _on_message
    _client.on_disconnect = _on_disconnect

    # Enable automatic reconnection
    _client.reconnect_delay_set(min_delay=1, max_delay=60)

    try:
        _client.connect(settings.MQTT_BROKER_HOST, settings.MQTT_BROKER_PORT, keepalive=60)
    except OSError as exc:
        logger.warning("Could not connect to MQTT broker at %s:%s – %s. Will retry in background.",
                        settings.MQTT_BROKER_HOST, settings.MQTT_BROKER_PORT, exc)

    # loop_start() spawns its own daemon thread
    _client.loop_start()
    logger.info("MQTT background loop started.")


def stop_mqtt() -> None:
    """Gracefully stop the MQTT client."""
    global _client
    if _client is not None:
        _client.loop_stop()
        _client.disconnect()
        logger.info("MQTT client stopped.")
        _client = None
