"""
HealthGuard Edge Node – Application Configuration.

Reads from .env file with sensible defaults for Raspberry Pi deployment.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables / .env file."""

    # ── Device ──────────────────────────────────────────────────────────
    DEVICE_ID: str

    # ── Database ────────────────────────────────────────────────────────
    DATABASE_URL: str

    # ── Sensor ──────────────────────────────────────────────────────────
    MOCK_MODE: bool = True
    SENSOR_INTERVAL_SECONDS: int = 5

    # ── Central Server Sync ─────────────────────────────────────────────
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str
    SUPABASE_VITALS_TABLE: str
    SUPABASE_PATIENTS_TABLE: str
    SUPABASE_ALERTS_TABLE: str
    SUPABASE_APPOINTMENTS_TABLE: str
    SUPABASE_DOCTORS_TABLE: str
    DOCTOR_BACKEND_URL: str
    SYNC_INTERVAL_SECONDS: int = 300
    SYNC_BATCH_SIZE: int = 100

    # ── Security ────────────────────────────────────────────────────────
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours
    DEFAULT_ADMIN_PASSWORD: str

    # ── Alert Thresholds ────────────────────────────────────────────────
    ALERT_HR_LOW: float = 50.0
    ALERT_HR_HIGH: float = 120.0
    ALERT_SPO2_LOW: float = 90.0
    ALERT_TEMP_HIGH: float = 38.5
    ALERT_TEMP_LOW: float = 35.0
    ALERT_BP_SYS_HIGH: float = 140.0
    ALERT_BP_SYS_LOW: float = 90.0
    ALERT_BP_DIA_HIGH: float = 90.0
    ALERT_BP_DIA_LOW: float = 60.0
    ALERT_RR_HIGH: float = 25.0
    ALERT_RR_LOW: float = 10.0
    ALERT_COOLDOWN_SECONDS: int = 300

    # ── Server ──────────────────────────────────────────────────────────
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
    }


@lru_cache
def get_settings() -> Settings:
    """Cached settings singleton."""
    return Settings()
