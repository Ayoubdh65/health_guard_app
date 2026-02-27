"""
HealthGuard Edge Node – Alert API Routes.
"""

import asyncio
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database.database import get_db
from app.database.models import User, Alert
from app.schemas import AlertResponse, AlertsPaginated, AlertStats
from app.sensors.alert_engine import subscribe_alerts, unsubscribe_alerts

router = APIRouter(prefix="/api/alerts", tags=["Alerts"])


@router.get("", response_model=AlertsPaginated)
async def list_alerts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    severity: str | None = Query(None, regex="^(warning|critical)$"),
    acknowledged: bool | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Paginated list of alerts with optional filters."""
    query = select(Alert)

    if severity:
        query = query.where(Alert.severity == severity)
    if acknowledged is not None:
        query = query.where(Alert.acknowledged == acknowledged)

    # Total count
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Paginated results
    query = query.order_by(desc(Alert.timestamp))
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = result.scalars().all()

    pages = max(1, -(-total // page_size))

    return AlertsPaginated(
        items=[AlertResponse.model_validate(a) for a in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.get("/active", response_model=list[AlertResponse])
async def active_alerts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all unacknowledged alerts, most recent first."""
    result = await db.execute(
        select(Alert)
        .where(Alert.acknowledged == False)  # noqa: E712
        .order_by(desc(Alert.timestamp))
        .limit(50)
    )
    items = result.scalars().all()
    return [AlertResponse.model_validate(a) for a in items]


@router.get("/stats", response_model=AlertStats)
async def alert_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Aggregate alert counts by severity and acknowledgement status."""
    total = (await db.execute(select(func.count(Alert.id)))).scalar() or 0
    critical = (
        await db.execute(
            select(func.count(Alert.id)).where(Alert.severity == "critical")
        )
    ).scalar() or 0
    warning = (
        await db.execute(
            select(func.count(Alert.id)).where(Alert.severity == "warning")
        )
    ).scalar() or 0
    unacknowledged = (
        await db.execute(
            select(func.count(Alert.id)).where(Alert.acknowledged == False)  # noqa: E712
        )
    ).scalar() or 0

    return AlertStats(
        total=total,
        critical=critical,
        warning=warning,
        unacknowledged=unacknowledged,
    )


@router.get("/stream")
async def stream_alerts(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """Server-Sent Events (SSE) endpoint for real-time alert notifications."""

    async def event_generator():
        q = subscribe_alerts()
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    alert_data = await asyncio.wait_for(q.get(), timeout=30)
                    yield f"data: {json.dumps(alert_data)}\n\n"
                except asyncio.TimeoutError:
                    # Keepalive comment to prevent connection drop
                    yield ": keepalive\n\n"
        finally:
            unsubscribe_alerts(q)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/{alert_id}/acknowledge", response_model=AlertResponse)
async def acknowledge_alert(
    alert_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark an alert as acknowledged."""
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()

    if alert is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found"
        )

    if alert.acknowledged:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Alert already acknowledged",
        )

    alert.acknowledged = True
    alert.acknowledged_at = datetime.now(timezone.utc)
    alert.acknowledged_by = current_user.username
    await db.flush()
    await db.refresh(alert)
    return AlertResponse.model_validate(alert)

