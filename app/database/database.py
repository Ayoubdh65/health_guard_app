"""
HealthGuard Edge Node – Async Database Engine & Session.

Uses SQLAlchemy 2.0 async API with aiosqlite for local SQLite storage.
"""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},  # required for SQLite
)

async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""
    pass


def _run_startup_migrations(sync_conn) -> None:
    """Apply lightweight SQLite migrations for existing edge-node databases."""
    patient_columns = {
        row[1] for row in sync_conn.exec_driver_sql("PRAGMA table_info(patients)").fetchall()
    }

    if "doctor_id" not in patient_columns:
        sync_conn.exec_driver_sql("ALTER TABLE patients ADD COLUMN doctor_id VARCHAR(50)")

    if "doctor_invite_code" not in patient_columns:
        sync_conn.exec_driver_sql("ALTER TABLE patients ADD COLUMN doctor_invite_code VARCHAR(20)")

    if "assigned_doctor_name" not in patient_columns:
        sync_conn.exec_driver_sql("ALTER TABLE patients ADD COLUMN assigned_doctor_name VARCHAR(150)")

    sync_conn.exec_driver_sql(
        "CREATE INDEX IF NOT EXISTS ix_patients_doctor_id ON patients (doctor_id)"
    )


async def get_db() -> AsyncSession:
    """FastAPI dependency – yields an async DB session."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db() -> None:
    """Create all tables on startup."""
    async with engine.begin() as conn:
        from app.database.models import Patient, VitalReading, SyncLog, Alert, Appointment  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_run_startup_migrations)
