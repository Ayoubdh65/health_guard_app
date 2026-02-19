"""
HealthGuard Edge Node – Application Configuration.

Reads from .env file with sensible defaults for Raspberry Pi deployment.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables / .env file."""

    # ── Device ──────────────────────────────────────────────────────────
    DEVICE_ID: str = "edge-node-001"

    # ── Database ────────────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite+aiosqlite:///./healthguard.db"

    # ── Sensor ──────────────────────────────────────────────────────────
    MOCK_MODE: bool = True
    SENSOR_INTERVAL_SECONDS: int = 5

    # ── Central Server Sync ─────────────────────────────────────────────
    CENTRAL_SERVER_URL: str = "https://central.healthguard.example.com/api"
    CENTRAL_API_KEY: str = "change-me"
    SYNC_INTERVAL_SECONDS: int = 300
    SYNC_BATCH_SIZE: int = 100

    # ── Security ────────────────────────────────────────────────────────
    SECRET_KEY: str = "change-this-to-a-random-secret-key"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours
    DEFAULT_ADMIN_PASSWORD: str = "admin"

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
