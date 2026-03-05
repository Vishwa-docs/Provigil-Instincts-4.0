"""Application configuration loaded from environment variables / .env file."""

import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve .env at the project root (one level above backend/)
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
_ENV_FILE = str(_PROJECT_ROOT / ".env")


class Settings(BaseSettings):
    """Pro-Vigil application settings.

    Values are loaded from environment variables first, then from a .env file
    located at the project root.
    """

    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── General ───────────────────────────────────────────────────────────
    APP_NAME: str = "Pro-Vigil"
    SECRET_KEY: str = "change-me-in-production"

    # ── Database ──────────────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite:///./data/provigil.db"

    # ── MQTT ──────────────────────────────────────────────────────────────
    MQTT_BROKER_HOST: str = "localhost"
    MQTT_BROKER_PORT: int = 1883
    MQTT_TOPIC_PREFIX: str = "pro-vigil/meter"

    # ── ML Model ──────────────────────────────────────────────────────────
    MODEL_PATH: str = "../model/exported/anomaly_model.pkl"
    SCALER_PATH: str = "../model/exported/scaler.pkl"

    # ── Scoring thresholds ────────────────────────────────────────────────
    ANOMALY_THRESHOLD_WARNING: float = 0.6
    ANOMALY_THRESHOLD_CRITICAL: float = 0.85

    # ── Scheduler ─────────────────────────────────────────────────────────
    SCORING_INTERVAL_SECONDS: int = 30


settings = Settings()
