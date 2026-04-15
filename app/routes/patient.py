"""
HealthGuard Edge Node – Patient API Routes.
"""

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.config import get_settings
from app.database.database import get_db
from app.database.models import Patient, User
from app.schemas import PatientCreate, PatientResponse, PatientUpdate

router = APIRouter(prefix="/api/patient", tags=["Patient"])


def _is_placeholder_patient(patient: Patient) -> bool:
    return (
        patient.first_name == "Default"
        and patient.last_name == "Patient"
        and patient.medical_id == "MED-000001"
        and (patient.doctor_id is None or not patient.doctor_id.strip())
    )


async def _resolve_doctor_code(doctor_code: str) -> dict:
    settings = get_settings()
    lookup_url = f"{settings.DOCTOR_BACKEND_URL}/public/doctors/lookup"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                lookup_url,
                params={"code": doctor_code.strip().upper()},
            )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Doctor verification service is unavailable: {exc}",
        ) from exc

    if response.status_code == 404:
        raise HTTPException(status_code=400, detail="Doctor code not found")

    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Doctor verification failed with HTTP {response.status_code}",
        )

    payload = response.json()
    doctor = payload.get("doctor")
    if not payload.get("valid") or not doctor:
        raise HTTPException(status_code=400, detail="Doctor code is invalid")

    return doctor


def _apply_patient_payload(patient: Patient, payload_data: dict, doctor: dict | None = None) -> None:
    doctor_code = payload_data.pop("doctor_code", None)

    for key, value in payload_data.items():
        setattr(patient, key, value)

    if doctor_code and doctor:
        patient.doctor_id = str(doctor["id"])
        patient.doctor_invite_code = doctor["inviteCode"]
        patient.assigned_doctor_name = doctor["fullName"]


@router.get("", response_model=PatientResponse)
async def get_patient(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the single patient profile on this edge node."""
    result = await db.execute(select(Patient).limit(1))
    patient = result.scalar_one_or_none()
    if patient is None:
        raise HTTPException(status_code=404, detail="No patient profile configured")
    return PatientResponse.model_validate(patient)


@router.post("", response_model=PatientResponse, status_code=201)
async def create_patient(
    payload: PatientCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register the patient profile stored on this edge node."""
    doctor = await _resolve_doctor_code(payload.doctor_code)
    result = await db.execute(select(Patient).limit(1))
    patient = result.scalar_one_or_none()
    payload_data = payload.model_dump()

    if patient is None:
        patient = Patient()
        _apply_patient_payload(patient, payload_data, doctor)
        db.add(patient)
        await db.flush()
        await db.refresh(patient)
        return PatientResponse.model_validate(patient)

    if not _is_placeholder_patient(patient):
        raise HTTPException(
            status_code=409,
            detail="A patient profile is already registered on this device",
        )

    _apply_patient_payload(patient, payload_data, doctor)
    await db.flush()
    await db.refresh(patient)
    return PatientResponse.model_validate(patient)


@router.put("", response_model=PatientResponse)
async def update_patient(
    payload: PatientUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the patient profile."""
    result = await db.execute(select(Patient).limit(1))
    patient = result.scalar_one_or_none()
    if patient is None:
        raise HTTPException(status_code=404, detail="No patient profile configured")

    update_data = payload.model_dump(exclude_unset=True)
    doctor = None

    if "doctor_code" in update_data:
        doctor = await _resolve_doctor_code(update_data["doctor_code"])

    _apply_patient_payload(patient, update_data, doctor)

    await db.flush()
    await db.refresh(patient)
    return PatientResponse.model_validate(patient)
