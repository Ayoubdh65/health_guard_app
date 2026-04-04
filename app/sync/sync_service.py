"""
HealthGuard Edge Node – Data Synchronization Service.

Sync strategy:
1. Upsert local patient records to Supabase
2. Upsert unsynced local vital readings to Supabase
3. Upsert alerts to Supabase
4. Mark local vital readings as synced after successful upload
5. Write local sync audit logs via SyncLog
"""

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.database.database import async_session
from app.database.models import Alert, Patient, SyncLog, VitalReading
from app.schemas import SyncResult

logger = logging.getLogger(__name__)

MAX_RETRIES = 3
BACKOFF_BASE = 2  # seconds


def _supabase_headers(service_role_key: str) -> dict[str, str]:
    return {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }


def _safe_iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def _build_full_name(patient: Patient) -> str:
    first = (patient.first_name or "").strip()
    last = (patient.last_name or "").strip()
    return f"{first} {last}".strip()


async def _post_with_retry(
    url: str,
    payload: list[dict[str, Any]],
    headers: dict[str, str],
) -> tuple[bool, str | None]:
    last_error = None

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, json=payload, headers=headers)

            if response.status_code in (200, 201):
                return True, None

            last_error = f"HTTP {response.status_code} - {response.text[:300]}"
            logger.warning(
                f"Supabase sync attempt {attempt}/{MAX_RETRIES} failed: {last_error}"
            )

        except httpx.HTTPError as exc:
            last_error = str(exc)
            logger.warning(
                f"Supabase sync attempt {attempt}/{MAX_RETRIES} network error: {exc}"
            )

        if attempt < MAX_RETRIES:
            backoff = BACKOFF_BASE ** attempt
            logger.info(f"Retrying in {backoff}s...")
            await asyncio.sleep(backoff)

    return False, last_error


async def sync_patients(session: AsyncSession) -> tuple[bool, int, str | None]:
    settings = get_settings()

    result = await session.execute(
        select(Patient).order_by(Patient.updated_at.desc(), Patient.id.desc())
    )
    patients = result.scalars().all()

    if not patients:
        return True, 0, None

    payload_data = [
        {
            "patient_uuid": p.uuid,
            "device_id": settings.DEVICE_ID,
            "full_name": _build_full_name(p),
            "first_name": p.first_name,
            "last_name": p.last_name,
            "date_of_birth": p.date_of_birth,
            "medical_id": p.medical_id,
            "blood_type": p.blood_type,
            "emergency_contact": p.emergency_contact,
            "notes": p.notes,
            "created_at": _safe_iso(p.created_at),
            "updated_at": _safe_iso(datetime.now(timezone.utc)),
        }
        for p in patients
    ]

    supabase_url = (
        f"{settings.SUPABASE_URL}/rest/v1/{settings.SUPABASE_PATIENTS_TABLE}"
        f"?on_conflict=patient_uuid"
    )

    success, error = await _post_with_retry(
        url=supabase_url,
        payload=payload_data,
        headers=_supabase_headers(settings.SUPABASE_SERVICE_ROLE_KEY),
    )

    if success:
        logger.info(f"Synced {len(payload_data)} patient(s) to Supabase")
        return True, len(payload_data), None

    logger.error(f"Patient sync failed: {error}")
    return False, 0, error


async def sync_vitals(session: AsyncSession) -> tuple[bool, int, str | None]:
    settings = get_settings()

    result = await session.execute(
        select(VitalReading)
        .options(selectinload(VitalReading.patient))
        .where(VitalReading.synced == False)  # noqa: E712
        .order_by(VitalReading.timestamp)
        .limit(settings.SYNC_BATCH_SIZE)
    )
    readings = result.scalars().all()

    if not readings:
        return True, 0, None

    payload_data = [
        {
            "uuid": r.uuid,
            "patient_uuid": r.patient.uuid if r.patient else None,
            "device_id": settings.DEVICE_ID,
            "timestamp": _safe_iso(r.timestamp),
            "heart_rate": r.heart_rate,
            "spo2": r.spo2,
            "temperature": r.temperature,
            "blood_pressure_sys": r.blood_pressure_sys,
            "blood_pressure_dia": r.blood_pressure_dia,
            "respiratory_rate": r.respiratory_rate,
            "ppg_raw": r.ppg_raw,
        }
        for r in readings
    ]

    supabase_url = (
        f"{settings.SUPABASE_URL}/rest/v1/{settings.SUPABASE_VITALS_TABLE}"
        f"?on_conflict=uuid"
    )

    success, error = await _post_with_retry(
        url=supabase_url,
        payload=payload_data,
        headers=_supabase_headers(settings.SUPABASE_SERVICE_ROLE_KEY),
    )

    if not success:
        logger.error(f"Vitals sync failed: {error}")
        return False, 0, error

    reading_ids = [r.id for r in readings]
    await session.execute(
        update(VitalReading)
        .where(VitalReading.id.in_(reading_ids))
        .values(
            synced=True,
            synced_at=datetime.now(timezone.utc),
        )
    )
    await session.commit()

    logger.info(f"Synced {len(readings)} vital reading(s) to Supabase")
    return True, len(readings), None


async def sync_alerts(session: AsyncSession) -> tuple[bool, int, str | None]:
    settings = get_settings()

    result = await session.execute(
        select(Alert)
        .options(
            selectinload(Alert.patient),
            selectinload(Alert.reading),
        )
        .order_by(Alert.timestamp.desc(), Alert.id.desc())
    )
    alerts = result.scalars().all()

    if not alerts:
        return True, 0, None

    payload_data = [
        {
            "uuid": a.uuid,
            "patient_uuid": a.patient.uuid if a.patient else None,
            "reading_uuid": a.reading.uuid if a.reading else None,
            "device_id": settings.DEVICE_ID,
            "timestamp": _safe_iso(a.timestamp),
            "severity": a.severity,
            "alert_type": a.alert_type,
            "vital_name": a.vital_name,
            "vital_value": a.vital_value,
            "threshold": a.threshold,
            "message": a.message,
            "acknowledged": a.acknowledged,
            "acknowledged_at": _safe_iso(a.acknowledged_at),
            "acknowledged_by": a.acknowledged_by,
        }
        for a in alerts
    ]

    supabase_url = (
        f"{settings.SUPABASE_URL}/rest/v1/{settings.SUPABASE_ALERTS_TABLE}"
        f"?on_conflict=uuid"
    )

    success, error = await _post_with_retry(
        url=supabase_url,
        payload=payload_data,
        headers=_supabase_headers(settings.SUPABASE_SERVICE_ROLE_KEY),
    )

    if success:
        logger.info(f"Synced {len(alerts)} alert(s) to Supabase")
        return True, len(alerts), None

    logger.error(f"Alerts sync failed: {error}")
    return False, 0, error


async def sync_now() -> SyncResult:
    start_ms = int(time.time() * 1000)
    records_sent = 0
    status = "success"
    error_msg = None

    try:
        async with async_session() as session:
            patients_ok, _patients_count, patients_error = await sync_patients(session)
            if not patients_ok:
                status = "failed"
                error_msg = f"Patient sync failed: {patients_error}"
            else:
                vitals_ok, vitals_count, vitals_error = await sync_vitals(session)
                if not vitals_ok:
                    status = "failed"
                    error_msg = f"Vitals sync failed: {vitals_error}"
                else:
                    alerts_ok, alerts_count, alerts_error = await sync_alerts(session)
                    if not alerts_ok:
                        status = "failed"
                        error_msg = f"Alerts sync failed: {alerts_error}"
                    else:
                        records_sent = vitals_count + alerts_count

    except Exception as exc:
        status = "failed"
        error_msg = str(exc)
        logger.error(f"Sync error: {exc}", exc_info=True)

    duration = int(time.time() * 1000) - start_ms

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
    log = SyncLog(
        records_sent=records_sent,
        status=status,
        error_message=error_message,
        duration_ms=duration_ms,
    )
    session.add(log)
    await session.commit()