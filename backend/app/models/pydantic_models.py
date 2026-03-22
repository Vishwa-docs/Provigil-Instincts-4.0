"""Pydantic models for API request / response serialisation."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ═══════════════════════════════════════════════════════════════════════════════
# Meter
# ═══════════════════════════════════════════════════════════════════════════════


class MeterResponse(BaseModel):
    id: str
    name: str
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    ip_address: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None
    install_date: Optional[datetime] = None
    status: str
    health_score: float
    last_seen: Optional[datetime] = None
    suspected_issue: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MeterListResponse(BaseModel):
    meters: List[MeterResponse]
    total: int


# ═══════════════════════════════════════════════════════════════════════════════
# Reading
# ═══════════════════════════════════════════════════════════════════════════════


class ReadingCreate(BaseModel):
    meter_id: str
    timestamp: Optional[datetime] = None
    voltage: Optional[float] = None
    current: Optional[float] = None
    power: Optional[float] = None
    energy_import: Optional[float] = None
    temperature: Optional[float] = None
    frequency: Optional[float] = None
    power_factor: Optional[float] = None
    thd: Optional[float] = None
    relay_chatter_ms: Optional[float] = None
    battery_voltage: Optional[float] = None
    harmonic_distortion: Optional[float] = None
    firmware_heap_pct: Optional[float] = None
    local_alert: bool = False
    raw_data: Optional[Dict[str, Any]] = None


class ReadingResponse(BaseModel):
    id: int
    meter_id: str
    timestamp: datetime
    voltage: Optional[float] = None
    current: Optional[float] = None
    power: Optional[float] = None
    energy_import: Optional[float] = None
    temperature: Optional[float] = None
    frequency: Optional[float] = None
    power_factor: Optional[float] = None
    thd: Optional[float] = None
    relay_chatter_ms: Optional[float] = None
    battery_voltage: Optional[float] = None
    harmonic_distortion: Optional[float] = None
    firmware_heap_pct: Optional[float] = None
    local_alert: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════════
# Anomaly
# ═══════════════════════════════════════════════════════════════════════════════


class AnomalyResponse(BaseModel):
    id: int
    meter_id: str
    detected_at: datetime
    anomaly_score: float
    risk_level: str
    suspected_issue: Optional[str] = None
    contributing_factors: Optional[Any] = None
    resolved: bool
    resolved_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════════
# Alert
# ═══════════════════════════════════════════════════════════════════════════════


class AlertResponse(BaseModel):
    id: int
    meter_id: str
    alert_type: str
    severity: str
    message: str
    acknowledged: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AlertAcknowledge(BaseModel):
    acknowledged: bool = True


# ═══════════════════════════════════════════════════════════════════════════════
# Work Order
# ═══════════════════════════════════════════════════════════════════════════════


class WorkOrderCreate(BaseModel):
    meter_id: str
    priority: int = Field(default=3, ge=1, le=5)
    issue_type: str
    description: Optional[str] = None
    scheduled_date: Optional[datetime] = None


class WorkOrderResponse(BaseModel):
    id: int
    meter_id: str
    priority: int
    status: str
    issue_type: str
    description: Optional[str] = None
    scheduled_date: Optional[datetime] = None
    completed_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WorkOrderUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[int] = Field(default=None, ge=1, le=5)
    scheduled_date: Optional[datetime] = None
    description: Optional[str] = None


# ═══════════════════════════════════════════════════════════════════════════════
# Health Score
# ═══════════════════════════════════════════════════════════════════════════════


class HealthScoreResponse(BaseModel):
    meter_id: str
    current_score: float
    status: str
    history: List[Dict[str, Any]] = []  # [{timestamp, score}, …]


# ═══════════════════════════════════════════════════════════════════════════════
# Dashboard
# ═══════════════════════════════════════════════════════════════════════════════


class DashboardStats(BaseModel):
    total_meters: int
    healthy: int
    warning: int
    critical: int
    total_alerts_24h: int
    avg_health_score: float


# ═══════════════════════════════════════════════════════════════════════════════
# Telemetry Ingest
# ═══════════════════════════════════════════════════════════════════════════════


class TelemetryIngest(BaseModel):
    meter_id: str
    timestamp: Optional[datetime] = None
    voltage: Optional[float] = None
    current: Optional[float] = None
    power: Optional[float] = None
    energy_import: Optional[float] = None
    temperature: Optional[float] = None
    frequency: Optional[float] = None
    power_factor: Optional[float] = None
    thd: Optional[float] = None
    relay_chatter_ms: Optional[float] = None
    battery_voltage: Optional[float] = None
    harmonic_distortion: Optional[float] = None
    firmware_heap_pct: Optional[float] = None
    local_alert: bool = False
    raw_data: Optional[Dict[str, Any]] = None


# ═════════════════════════════════════════════════════════════════════════════
# Subscriber
# ═════════════════════════════════════════════════════════════════════════════


class SubscriberCreate(BaseModel):
    email: str = Field(..., min_length=5, max_length=256)


class SubscriberResponse(BaseModel):
    id: int
    email: str
    subscribed_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


class ScenarioTriggerResponse(BaseModel):
    meter_id: str
    alert_id: int
    work_order_id: int
    message: str
    detection_method: str = ""
    parameters_changed: list = []
