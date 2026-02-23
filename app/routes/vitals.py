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

from app.auth import get_current_user
from app.database.database import get_db
from app.database.models import User, VitalReading
from app.schemas import VitalReadingResponse, VitalStats, VitalsPaginated

router = APIRouter(prefix="/api/vitals", tags=["Vitals"])


@router.get("", response_model=VitalsPaginated)
async def list_vitals(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    current_user: User = Depends(get_current_user),
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


@router.get("/history", response_model=None)
async def vital_history(
    period: str = Query("24h", regex="^(1h|6h|24h|7d|30d)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Time-series vital data for historical charting.

    Periods: 1h, 6h, 24h, 7d, 30d.
    Short periods return raw readings; longer periods return averaged buckets.
    """
    from app.schemas import VitalHistoryPoint, VitalHistoryResponse

    period_map = {
        "1h": timedelta(hours=1),
        "6h": timedelta(hours=6),
        "24h": timedelta(hours=24),
        "7d": timedelta(days=7),
        "30d": timedelta(days=30),
    }
    delta = period_map[period]
    cutoff = datetime.now(timezone.utc) - delta

    # For short periods, return raw readings; for longer, limit to keep payload manageable
    max_points = 500 if period in ("1h", "6h") else 300

    result = await db.execute(
        select(VitalReading)
        .where(VitalReading.timestamp >= cutoff)
        .order_by(VitalReading.timestamp)
    )
    readings = result.scalars().all()
    total_readings = len(readings)

    # Downsample if too many points
    if len(readings) > max_points:
        step = len(readings) / max_points
        sampled = [readings[int(i * step)] for i in range(max_points)]
        readings = sampled
        granularity = "sampled"
    else:
        granularity = "raw"

    points = [
        VitalHistoryPoint(
            timestamp=r.timestamp,
            heart_rate=round(r.heart_rate, 1) if r.heart_rate else None,
            spo2=round(r.spo2, 1) if r.spo2 else None,
            temperature=round(r.temperature, 1) if r.temperature else None,
            blood_pressure_sys=round(r.blood_pressure_sys, 1) if r.blood_pressure_sys else None,
            blood_pressure_dia=round(r.blood_pressure_dia, 1) if r.blood_pressure_dia else None,
            respiratory_rate=round(r.respiratory_rate, 1) if r.respiratory_rate else None,
        )
        for r in readings
    ]

    return VitalHistoryResponse(
        points=points,
        period=period,
        granularity=granularity,
        total_readings=total_readings,
    )


@router.get("/latest", response_model=Optional[VitalReadingResponse])
async def latest_vital(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
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
    current_user: User = Depends(get_current_user),
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
async def stream_vitals(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
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
