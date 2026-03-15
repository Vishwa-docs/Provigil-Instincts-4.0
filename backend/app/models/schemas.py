"""SQLAlchemy ORM models for the Pro-Vigil database."""

import json
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.database import Base


def _utcnow() -> datetime:
    """Return the current UTC timestamp."""
    return datetime.now(timezone.utc)


# ── Meter ─────────────────────────────────────────────────────────────────────


class Meter(Base):
    __tablename__ = "meters"

    id = Column(String(64), primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    location_lat = Column(Float, nullable=True)
    location_lng = Column(Float, nullable=True)
    install_date = Column(DateTime, nullable=True)
    status = Column(String(16), nullable=False, default="healthy")  # healthy / warning / critical
    health_score = Column(Float, nullable=False, default=1.0)       # 0.0 – 1.0
    last_seen = Column(DateTime, nullable=True)
    suspected_issue = Column(String(256), nullable=True)
    created_at = Column(DateTime, nullable=False, default=_utcnow)
    updated_at = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)

    # Relationships
    readings = relationship("Reading", back_populates="meter", cascade="all, delete-orphan")
    anomalies = relationship("Anomaly", back_populates="meter", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="meter", cascade="all, delete-orphan")
    work_orders = relationship("WorkOrder", back_populates="meter", cascade="all, delete-orphan")


# ── Reading ───────────────────────────────────────────────────────────────────


class Reading(Base):
    __tablename__ = "readings"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    meter_id = Column(String(64), ForeignKey("meters.id"), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, default=_utcnow)
    voltage = Column(Float, nullable=True)
    current = Column(Float, nullable=True)
    power = Column(Float, nullable=True)
    energy_import = Column(Float, nullable=True)
    temperature = Column(Float, nullable=True)
    frequency = Column(Float, nullable=True)
    power_factor = Column(Float, nullable=True)
    local_alert = Column(Boolean, nullable=False, default=False)
    raw_data = Column(Text, nullable=True)  # JSON-encoded string
    created_at = Column(DateTime, nullable=False, default=_utcnow)

    # Relationships
    meter = relationship("Meter", back_populates="readings")

    # ── Helpers ────────────────────────────────────────────────────────────
    def set_raw_data(self, data: dict) -> None:
        self.raw_data = json.dumps(data)

    def get_raw_data(self) -> dict | None:
        if self.raw_data is None:
            return None
        return json.loads(self.raw_data)


# ── Anomaly ───────────────────────────────────────────────────────────────────


class Anomaly(Base):
    __tablename__ = "anomalies"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    meter_id = Column(String(64), ForeignKey("meters.id"), nullable=False, index=True)
    detected_at = Column(DateTime, nullable=False, default=_utcnow)
    anomaly_score = Column(Float, nullable=False)
    risk_level = Column(String(16), nullable=False)   # low / warning / critical
    suspected_issue = Column(String(256), nullable=True)
    contributing_factors = Column(Text, nullable=True)  # JSON-encoded list/dict
    resolved = Column(Boolean, nullable=False, default=False)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=_utcnow)

    # Relationships
    meter = relationship("Meter", back_populates="anomalies")

    def set_contributing_factors(self, factors: list | dict) -> None:
        self.contributing_factors = json.dumps(factors)

    def get_contributing_factors(self) -> list | dict | None:
        if self.contributing_factors is None:
            return None
        return json.loads(self.contributing_factors)


# ── Alert ─────────────────────────────────────────────────────────────────────


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    meter_id = Column(String(64), ForeignKey("meters.id"), nullable=False, index=True)
    alert_type = Column(String(64), nullable=False)   # anomaly / comm_loss / threshold / maintenance
    severity = Column(String(16), nullable=False)      # info / warning / critical
    message = Column(String(512), nullable=False)
    acknowledged = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=_utcnow)

    # Relationships
    meter = relationship("Meter", back_populates="alerts")


# ── Work Order ────────────────────────────────────────────────────────────────


class WorkOrder(Base):
    __tablename__ = "work_orders"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    meter_id = Column(String(64), ForeignKey("meters.id"), nullable=False, index=True)
    priority = Column(Integer, nullable=False, default=3)   # 1 = highest
    status = Column(String(24), nullable=False, default="pending")  # pending / scheduled / in_progress / completed
    issue_type = Column(String(128), nullable=False)
    description = Column(Text, nullable=True)
    scheduled_date = Column(DateTime, nullable=True)
    completed_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=_utcnow)
    updated_at = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)

    # Relationships
    meter = relationship("Meter", back_populates="work_orders")


# ── Network Node ──────────────────────────────────────────────────────────────


class NetworkNode(Base):
    __tablename__ = "network_nodes"

    id = Column(String(64), primary_key=True, index=True)
    node_type = Column(String(24), nullable=False)  # feeder / transformer / meter
    name = Column(String(128), nullable=False)
    parent_id = Column(String(64), ForeignKey("network_nodes.id"), nullable=True, index=True)
    location_lat = Column(Float, nullable=True)
    location_lng = Column(Float, nullable=True)
    health_score = Column(Float, nullable=False, default=1.0)
    status = Column(String(16), nullable=False, default="healthy")
    created_at = Column(DateTime, nullable=False, default=_utcnow)

    parent = relationship("NetworkNode", remote_side=[id], backref="children")
