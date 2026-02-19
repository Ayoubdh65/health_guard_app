"""
HealthGuard Edge Node – System Status & Admin Routes.
"""

import os
import time

from fastapi import APIRouter, Depends

from app.auth import get_current_user
from app.database.models import User
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database.database import get_db
from app.database.models import VitalReading, SyncLog
from app.schemas import SystemStatus, SyncResult
from app.sensors.sensor_manager import get_sensor_reader

router = APIRouter(prefix="/api/system", tags=["System"])

_start_time = time.time()


@router.get("/status", response_model=SystemStatus)
async def system_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Device health: DB size, sync state, sensor status, uptime."""
    settings = get_settings()

    # Total & unsynced readings
    total = (await db.execute(select(func.count(VitalReading.id)))).scalar() or 0
    unsynced = (
        await db.execute(
            select(func.count(VitalReading.id)).where(VitalReading.synced == False)  # noqa: E712
        )
    ).scalar() or 0

    # Last sync
    last_sync_row = (
        await db.execute(select(SyncLog).order_by(desc(SyncLog.timestamp)).limit(1))
    ).scalar_one_or_none()

    # DB file size
    db_path = settings.DATABASE_URL.replace("sqlite+aiosqlite:///", "")
    try:
        db_size_mb = round(os.path.getsize(db_path) / (1024 * 1024), 2)
    except OSError:
        db_size_mb = 0.0

    # Sensor status
    reader = get_sensor_reader()
    sensor_status = "active" if reader and reader.is_available else "inactive"

    return SystemStatus(
        device_id=settings.DEVICE_ID,
        uptime_seconds=round(time.time() - _start_time, 1),
        database_size_mb=db_size_mb,
        total_readings=total,
        unsynced_readings=unsynced,
        last_sync=last_sync_row.timestamp if last_sync_row else None,
        last_sync_status=last_sync_row.status if last_sync_row else None,
        sensor_status=sensor_status,
        mock_mode=settings.MOCK_MODE,
    )


@router.post("/sync", response_model=SyncResult)
async def trigger_sync(current_user: User = Depends(get_current_user)):
    """Manually trigger a data sync to the central server."""
    from app.sync.sync_service import sync_now
    return await sync_now()
