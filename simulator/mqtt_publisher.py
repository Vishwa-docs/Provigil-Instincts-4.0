"""
MQTT publisher for ProVigil meter telemetry and events.

Connects to an MQTT broker and publishes JSON payloads on the
pro-vigil/meter/{meter_id}/telemetry and …/event topics.
"""

import json
import logging
import time
from typing import Any, Dict, Optional

import paho.mqtt.client as mqtt

logger = logging.getLogger(__name__)


class MQTTPublisher:
    """Thin wrapper around paho-mqtt for ProVigil telemetry publishing."""

    TOPIC_TELEMETRY = "pro-vigil/meter/{meter_id}/telemetry"
    TOPIC_EVENT = "pro-vigil/meter/{meter_id}/event"

    def __init__(
        self,
        host: str = "localhost",
        port: int = 1883,
        client_id: str = "provigil-simulator",
        username: Optional[str] = None,
        password: Optional[str] = None,
        keepalive: int = 60,
    ):
        self.host = host
        self.port = port
        self._client = mqtt.Client(client_id=client_id)

        if username:
            self._client.username_pw_set(username, password)

        self._client.on_connect = self._on_connect
        self._client.on_disconnect = self._on_disconnect
        self._connected = False

    # ------------------------------------------------------------------
    # Callbacks
    # ------------------------------------------------------------------

    def _on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            self._connected = True
            logger.info("MQTT connected to %s:%s", self.host, self.port)
        else:
            logger.error("MQTT connection failed, rc=%s", rc)

    def _on_disconnect(self, client, userdata, rc):
        self._connected = False
        if rc != 0:
            logger.warning("MQTT unexpected disconnect (rc=%s), will reconnect", rc)

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def connect(self) -> None:
        """Connect to the broker and start the network loop."""
        logger.info("Connecting to MQTT broker at %s:%s …", self.host, self.port)
        try:
            self._client.connect(self.host, self.port)
            self._client.loop_start()
            # Wait briefly for the on_connect callback
            deadline = time.time() + 5.0
            while not self._connected and time.time() < deadline:
                time.sleep(0.1)
            if not self._connected:
                logger.warning("MQTT connect timed out – will keep retrying in background")
        except Exception as exc:
            logger.error("MQTT connect error: %s", exc)

    def disconnect(self) -> None:
        """Gracefully disconnect and stop the network loop."""
        self._client.loop_stop()
        self._client.disconnect()
        self._connected = False
        logger.info("MQTT disconnected")

    @property
    def is_connected(self) -> bool:
        return self._connected

    # ------------------------------------------------------------------
    # Publishing
    # ------------------------------------------------------------------

    def _publish(self, topic: str, payload: dict, qos: int = 1) -> None:
        msg = json.dumps(payload, default=str)
        info = self._client.publish(topic, msg, qos=qos)
        if info.rc != mqtt.MQTT_ERR_SUCCESS:
            logger.warning("MQTT publish failed on %s (rc=%s)", topic, info.rc)

    def publish_telemetry(self, meter_id: str, data: Dict[str, Any]) -> None:
        """Publish a telemetry reading for *meter_id*."""
        topic = self.TOPIC_TELEMETRY.format(meter_id=meter_id)
        self._publish(topic, data)

    def publish_event(self, meter_id: str, event: Dict[str, Any]) -> None:
        """Publish an event (alert, status change, etc.) for *meter_id*."""
        topic = self.TOPIC_EVENT.format(meter_id=meter_id)
        self._publish(topic, event)
