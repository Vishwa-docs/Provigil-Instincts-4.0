"""Application configuration loaded from environment variables / .env file."""

from pathlib import Path

from pydantic import AliasChoices, Field
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
    LLM_PROVIDER: str = "azure"

    # ── Database ──────────────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite:///./data/provigil.db"

    # ── MQTT ──────────────────────────────────────────────────────────────
    MQTT_BROKER_HOST: str = "localhost"
    MQTT_BROKER_PORT: int = 1883
    MQTT_TOPIC_PREFIX: str = "pro-vigil/meter"

    # ── Scoring thresholds ────────────────────────────────────────────────
    ANOMALY_THRESHOLD_WARNING: float = 0.15
    ANOMALY_THRESHOLD_CRITICAL: float = 0.35

    # ── Scheduler ─────────────────────────────────────────────────────────
    SCORING_INTERVAL_SECONDS: int = 30

    # ── Azure OpenAI ──────────────────────────────────────────────────────
    AZURE_OPENAI_ENDPOINT: str = ""
    AZURE_OPENAI_API_KEY: str = ""
    AZURE_OPENAI_DEPLOYMENT: str = Field(
        default="gpt-4o",
        validation_alias=AliasChoices(
            "AZURE_OPENAI_DEPLOYMENT",
            "AZURE_OPENAI_DEPLOYMENT_NAME",
        ),
    )
    AZURE_OPENAI_API_VERSION: str = "2024-12-01-preview"

    # ── Email (Gmail SMTP) ────────────────────────────────────────────────
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USE_TLS: bool = True
    SMTP_USER: str = Field(
        default="",
        validation_alias=AliasChoices("SMTP_USER", "SMTP_EMAIL"),
    )
    SMTP_PASSWORD: str = Field(
        default="",
        validation_alias=AliasChoices("SMTP_PASSWORD", "SMTP_APP_PASSWORD"),
    )
    SMTP_FROM: str = Field(
        default="",
        validation_alias=AliasChoices("SMTP_FROM", "SMTP_USER", "SMTP_EMAIL"),
    )
    ALERT_RECIPIENTS: str = Field(
        default="",
        validation_alias=AliasChoices("ALERT_RECIPIENTS", "SMTP_TO"),
    )

    @property
    def SMTP_EMAIL(self) -> str:
        return self.SMTP_USER

    @property
    def SMTP_APP_PASSWORD(self) -> str:
        return self.SMTP_PASSWORD


settings = Settings()
