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
        from app.database.models import Patient, VitalReading, SyncLog  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)
