"""
HealthGuard Edge Node – Data Synchronization Service.

Pushes unsynced vital readings to the central server with:
  • HMAC-signed payloads for integrity
  • Batch uploads with configurable size
  • Exponential back-off retries
  • Full audit trail via SyncLog
"""

import hashlib
import hmac
import json
import logging
import time
from datetime import datetime, timezone

import httpx
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database.database import async_session
from app.database.models import VitalReading, SyncLog
from app.schemas import SyncResult

logger = logging.getLogger(__name__)

MAX_RETRIES = 3
BACKOFF_BASE = 2  # seconds


def _sign_payload(payload: str, secret: str) -> str:
    """Generate HMAC-SHA256 signature for the payload."""
    return hmac.new(
        secret.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


async def sync_now() -> SyncResult:
    """
    Execute one sync cycle: fetch unsynced readings, push to central
    server, mark as synced, and log the result.
    """
    settings = get_settings()
    start_ms = int(time.time() * 1000)
    records_sent = 0
    status = "success"
    error_msg = None

    try:
        async with async_session() as session:
            # ── Fetch unsynced batch ──
            result = await session.execute(
                select(VitalReading)
                .where(VitalReading.synced == False)  # noqa: E712
                .order_by(VitalReading.timestamp)
                .limit(settings.SYNC_BATCH_SIZE)
            )
            readings = result.scalars().all()

            if not readings:
                duration = int(time.time() * 1000) - start_ms
                await _log_sync(session, 0, "success", None, duration)
                return SyncResult(
                    status="success",
                    records_sent=0,
                    duration_ms=duration,
                )

            # ── Build payload ──
            payload_data = {
                "device_id": settings.DEVICE_ID,
                "batch_timestamp": datetime.now(timezone.utc).isoformat(),
                "readings": [
                    {
                        "uuid": r.uuid,
                        "timestamp": r.timestamp.isoformat() if r.timestamp else None,
                        "heart_rate": r.heart_rate,
                        "spo2": r.spo2,
                        "temperature": r.temperature,
                        "blood_pressure_sys": r.blood_pressure_sys,
                        "blood_pressure_dia": r.blood_pressure_dia,
                        "respiratory_rate": r.respiratory_rate,
                    }
                    for r in readings
                ],
            }

            payload_json = json.dumps(payload_data, default=str)
            signature = _sign_payload(payload_json, settings.CENTRAL_API_KEY)

            # ── Send with retry ──
            headers = {
                "Content-Type": "application/json",
                "X-Device-ID": settings.DEVICE_ID,
                "X-Signature": signature,
                "Authorization": f"Bearer {settings.CENTRAL_API_KEY}",
            }

            sent = False
            for attempt in range(1, MAX_RETRIES + 1):
                try:
                    async with httpx.AsyncClient(timeout=30.0) as client:
                        response = await client.post(
                            f"{settings.CENTRAL_SERVER_URL}/sync/upload",
                            content=payload_json,
                            headers=headers,
                        )

                    if response.status_code in (200, 201, 202):
                        sent = True
                        records_sent = len(readings)
                        break
                    else:
                        logger.warning(
                            f"Sync attempt {attempt}/{MAX_RETRIES} failed: "
                            f"HTTP {response.status_code} – {response.text[:200]}"
                        )
                except httpx.HTTPError as exc:
                    logger.warning(
                        f"Sync attempt {attempt}/{MAX_RETRIES} network error: {exc}"
                    )

                if attempt < MAX_RETRIES:
                    backoff = BACKOFF_BASE ** attempt
                    logger.info(f"Retrying in {backoff}s…")
                    import asyncio
                    await asyncio.sleep(backoff)

            # ── Mark synced ──
            if sent:
                reading_ids = [r.id for r in readings]
                await session.execute(
                    update(VitalReading)
                    .where(VitalReading.id.in_(reading_ids))
                    .values(synced=True, synced_at=datetime.now(timezone.utc))
                )
                await session.commit()
                logger.info(f"✅ Synced {records_sent} readings to central server")
            else:
                status = "failed"
                error_msg = "All retry attempts exhausted"
                logger.error(f"❌ Sync failed after {MAX_RETRIES} attempts")

    except Exception as exc:
        status = "failed"
        error_msg = str(exc)
        logger.error(f"Sync error: {exc}", exc_info=True)

    duration = int(time.time() * 1000) - start_ms

    # ── Audit log ──
    async with async_session() as session:
        await _log_sync(session, records_sent, status, error_msg, duration)

    return SyncResult(
        status=status,
        records_sent=records_sent,
        duration_ms=duration,
        error=error_msg,
    )


async def _log_sync(
    session: AsyncSession,
    records_sent: int,
    status: str,
    error_message: str | None,
    duration_ms: int,
) -> None:
    """Write an entry to the SyncLog table."""
    log = SyncLog(
        records_sent=records_sent,
        status=status,
        error_message=error_message,
        duration_ms=duration_ms,
    )
    session.add(log)
    await session.commit()
