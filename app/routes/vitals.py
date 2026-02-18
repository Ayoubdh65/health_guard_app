"""
HealthGuard Edge Node – Vital Signs API Routes.
"""

import asyncio
import json
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.database import get_db
from app.database.models import VitalReading
from app.schemas import VitalReadingResponse, VitalStats, VitalsPaginated

router = APIRouter(prefix="/api/vitals", tags=["Vitals"])


@router.get("", response_model=VitalsPaginated)
async def list_vitals(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db),
):
    """Paginated list of vital readings with optional time-range filter."""
    query = select(VitalReading)

    if start:
        query = query.where(VitalReading.timestamp >= start)
    if end:
        query = query.where(VitalReading.timestamp <= end)

    # Total count
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Paginated results
    query = query.order_by(desc(VitalReading.timestamp))
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = result.scalars().all()

    pages = max(1, -(-total // page_size))  # ceil division

    return VitalsPaginated(
        items=[VitalReadingResponse.model_validate(r) for r in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.get("/latest", response_model=Optional[VitalReadingResponse])
async def latest_vital(db: AsyncSession = Depends(get_db)):
    """Most recent vital reading."""
    result = await db.execute(
        select(VitalReading).order_by(desc(VitalReading.timestamp)).limit(1)
    )
    reading = result.scalar_one_or_none()
    if reading is None:
        return None
    return VitalReadingResponse.model_validate(reading)


@router.get("/stats", response_model=VitalStats)
async def vital_stats(
    hours: int = Query(24, ge=1, le=720),
    db: AsyncSession = Depends(get_db),
):
    """Aggregated stats (avg/min/max) over the last N hours."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)

    query = select(
        func.count(VitalReading.id).label("total"),
        func.avg(VitalReading.heart_rate).label("hr_avg"),
        func.min(VitalReading.heart_rate).label("hr_min"),
        func.max(VitalReading.heart_rate).label("hr_max"),
        func.avg(VitalReading.spo2).label("spo2_avg"),
        func.min(VitalReading.spo2).label("spo2_min"),
        func.max(VitalReading.spo2).label("spo2_max"),
        func.avg(VitalReading.temperature).label("temp_avg"),
        func.avg(VitalReading.blood_pressure_sys).label("bp_sys_avg"),
        func.avg(VitalReading.blood_pressure_dia).label("bp_dia_avg"),
        func.avg(VitalReading.respiratory_rate).label("rr_avg"),
    ).where(VitalReading.timestamp >= cutoff)

    row = (await db.execute(query)).one()

    return VitalStats(
        period_start=cutoff,
        period_end=datetime.now(timezone.utc),
        total_readings=row.total or 0,
        heart_rate_avg=round(row.hr_avg, 1) if row.hr_avg else None,
        heart_rate_min=round(row.hr_min, 1) if row.hr_min else None,
        heart_rate_max=round(row.hr_max, 1) if row.hr_max else None,
        spo2_avg=round(row.spo2_avg, 1) if row.spo2_avg else None,
        spo2_min=round(row.spo2_min, 1) if row.spo2_min else None,
        spo2_max=round(row.spo2_max, 1) if row.spo2_max else None,
        temperature_avg=round(row.temp_avg, 1) if row.temp_avg else None,
        blood_pressure_sys_avg=round(row.bp_sys_avg, 1) if row.bp_sys_avg else None,
        blood_pressure_dia_avg=round(row.bp_dia_avg, 1) if row.bp_dia_avg else None,
        respiratory_rate_avg=round(row.rr_avg, 1) if row.rr_avg else None,
    )


@router.get("/stream")
async def stream_vitals(request: Request, db: AsyncSession = Depends(get_db)):
    """Server-Sent Events (SSE) endpoint for real-time vital updates."""

    async def event_generator():
        last_id = 0
        # Get current max ID
        result = await db.execute(select(func.max(VitalReading.id)))
        max_id = result.scalar() or 0
        last_id = max_id

        while True:
            if await request.is_disconnected():
                break

            # Poll for new readings
            async with get_db_session() as session:
                result = await session.execute(
                    select(VitalReading)
                    .where(VitalReading.id > last_id)
                    .order_by(VitalReading.id)
                    .limit(10)
                )
                new_readings = result.scalars().all()

            for reading in new_readings:
                data = VitalReadingResponse.model_validate(reading)
                yield f"data: {data.model_dump_json()}\n\n"
                last_id = reading.id

            await asyncio.sleep(2)

    # We need a separate session for the generator
    from app.database.database import async_session as get_db_session

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
