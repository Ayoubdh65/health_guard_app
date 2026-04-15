"""
HealthGuard Edge Node - Appointment API Routes backed by Supabase.
"""

from datetime import datetime, timezone
from uuid import uuid4

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.config import get_settings
from app.database.database import get_db
from app.database.models import Patient, User
from app.schemas import AppointmentCreate, AppointmentResponse, AppointmentsPaginated, AppointmentStats

router = APIRouter(prefix="/api/appointments", tags=["Appointments"])


def _safe_iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def _supabase_headers(service_role_key: str, prefer: str = "return=representation") -> dict[str, str]:
    return {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
        "Prefer": prefer,
    }


async def _get_patient_or_404(db: AsyncSession) -> Patient:
    result = await db.execute(select(Patient).limit(1))
    patient = result.scalar_one_or_none()
    if patient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No patient profile configured",
        )
    return patient


def _sort_appointments(items: list[AppointmentResponse]) -> list[AppointmentResponse]:
    return sorted(
        items,
        key=lambda item: (
            0 if item.read_at is None else 1,
            -item.updated_at.timestamp(),
            item.scheduled_for,
        ),
    )


async def _fetch_supabase_appointments(patient_uuid: str) -> list[AppointmentResponse]:
    settings = get_settings()
    url = f"{settings.SUPABASE_URL}/rest/v1/{settings.SUPABASE_APPOINTMENTS_TABLE}"
    params = {
        "select": "id,uuid,patient_uuid,title,status,scheduled_for,location,notes,created_by,created_at,updated_at,read_at",
        "patient_uuid": f"eq.{patient_uuid}",
        "limit": "200",
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                url,
                params=params,
                headers=_supabase_headers(settings.SUPABASE_SERVICE_ROLE_KEY),
            )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Supabase request failed: {exc}",
        ) from exc

    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Supabase error: HTTP {response.status_code}",
        )

    payload = response.json()
    return _sort_appointments([AppointmentResponse.model_validate(item) for item in payload])


@router.get("", response_model=AppointmentsPaginated)
async def list_appointments(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    unread_only: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch appointment notifications from Supabase for the current patient."""
    patient = await _get_patient_or_404(db)
    items = await _fetch_supabase_appointments(patient.uuid)

    if unread_only:
        items = [item for item in items if item.read_at is None]

    total = len(items)
    start = (page - 1) * page_size
    end = start + page_size
    pages = max(1, -(-total // page_size))

    return AppointmentsPaginated(
        items=items[start:end],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.get("/stats", response_model=AppointmentStats)
async def appointment_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch appointment notification counts from Supabase."""
    patient = await _get_patient_or_404(db)
    items = await _fetch_supabase_appointments(patient.uuid)
    now = datetime.now(timezone.utc)

    return AppointmentStats(
        total=len(items),
        unread=sum(1 for item in items if item.read_at is None),
        upcoming=sum(1 for item in items if item.status == "scheduled" and item.scheduled_for >= now),
    )


@router.post("", response_model=AppointmentResponse, status_code=201)
async def create_appointment(
    payload: AppointmentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new appointment directly in Supabase."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can create appointments",
        )

    patient = await _get_patient_or_404(db)
    settings = get_settings()
    now = datetime.now(timezone.utc)
    appointment_uuid = str(uuid4())
    supabase_payload = {
        "uuid": appointment_uuid,
        "patient_uuid": patient.uuid,
        "title": payload.title,
        "status": "scheduled",
        "scheduled_for": _safe_iso(payload.scheduled_for),
        "location": payload.location,
        "notes": payload.notes,
        "created_by": current_user.username,
        "created_at": _safe_iso(now),
        "updated_at": _safe_iso(now),
        "read_at": None,
    }

    url = f"{settings.SUPABASE_URL}/rest/v1/{settings.SUPABASE_APPOINTMENTS_TABLE}"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                url,
                json=supabase_payload,
                headers=_supabase_headers(settings.SUPABASE_SERVICE_ROLE_KEY),
            )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Supabase request failed: {exc}",
        ) from exc

    if response.status_code not in (200, 201):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Supabase error: HTTP {response.status_code}",
        )

    created_items = response.json()
    if not created_items:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase did not return the created appointment",
        )

    return AppointmentResponse.model_validate(created_items[0])


@router.post("/{appointment_uuid}/read", response_model=AppointmentResponse)
async def mark_appointment_as_read(
    appointment_uuid: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a Supabase appointment notification as read."""
    patient = await _get_patient_or_404(db)
    settings = get_settings()
    now = datetime.now(timezone.utc)
    url = f"{settings.SUPABASE_URL}/rest/v1/{settings.SUPABASE_APPOINTMENTS_TABLE}"
    params = {
        "uuid": f"eq.{appointment_uuid}",
        "patient_uuid": f"eq.{patient.uuid}",
        "select": "id,uuid,patient_uuid,title,status,scheduled_for,location,notes,created_by,created_at,updated_at,read_at",
    }
    payload = {
        "read_at": _safe_iso(now),
        "updated_at": _safe_iso(now),
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.patch(
                url,
                params=params,
                json=payload,
                headers=_supabase_headers(settings.SUPABASE_SERVICE_ROLE_KEY),
            )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Supabase request failed: {exc}",
        ) from exc

    if response.status_code not in (200, 204):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Supabase error: HTTP {response.status_code}",
        )

    updated_items = response.json() if response.text else []
    if not updated_items:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found in Supabase",
        )

    return AppointmentResponse.model_validate(updated_items[0])
