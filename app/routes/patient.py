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


def _supabase_headers(service_role_key: str) -> dict[str, str]:
    return {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
    }


def _extract_doctor_record(raw_doctor: dict) -> dict:
    doctor_id = raw_doctor.get("id")
    invite_code = raw_doctor.get("invite_code")
    full_name = raw_doctor.get("full_name")

    if doctor_id is None or not invite_code or not full_name:
        raise HTTPException(
            status_code=502,
            detail=(
                "Doctor verification is misconfigured: expected Supabase doctors "
                "table columns id, invite_code, and full_name"
            ),
        )

    return {
        "id": str(doctor_id),
        "inviteCode": str(invite_code),
        "fullName": str(full_name),
    }


async def _resolve_doctor_code(doctor_code: str) -> dict:
    settings = get_settings()
    lookup_code = doctor_code.strip().upper()
    lookup_url = f"{settings.SUPABASE_URL}/rest/v1/{settings.SUPABASE_DOCTORS_TABLE}"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                lookup_url,
                params={
                    "select": "id,invite_code,full_name",
                    "invite_code": f"eq.{lookup_code}",
                    "limit": 1,
                },
                headers=_supabase_headers(settings.SUPABASE_SERVICE_ROLE_KEY),
            )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Doctor verification via Supabase is unavailable: {exc}",
        ) from exc

    if response.status_code == 400:
        raise HTTPException(
            status_code=502,
            detail=(
                "Doctor verification is misconfigured: the Supabase doctors table "
                "must contain id, invite_code, and full_name"
            ),
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Doctor verification failed with HTTP {response.status_code}",
        )

    payload = response.json()
    if not payload:
        raise HTTPException(status_code=400, detail="Doctor code not found")

    return _extract_doctor_record(payload[0])


def _apply_patient_payload(patient: Patient, payload_data: dict, doctor: dict | None = None) -> None:
    doctor_code = payload_data.pop("doctor_code", None)

    for key, value in payload_data.items():
        setattr(patient, key, value)

    if doctor_code and doctor:
        patient.doctor_id = str(doctor["id"])
        patient.doctor_invite_code = doctor["inviteCode"]
        patient.assigned_doctor_name = doctor["fullName"]


def _clear_patient_doctor(patient: Patient) -> None:
    patient.doctor_id = None
    patient.doctor_invite_code = None
    patient.assigned_doctor_name = None


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
    remove_doctor = update_data.pop("remove_doctor", False)
    doctor_code = update_data.get("doctor_code")
    doctor = None

    if remove_doctor and doctor_code:
        raise HTTPException(
            status_code=400,
            detail="Cannot remove doctor and assign a new doctor at the same time",
        )

    if remove_doctor:
        update_data.pop("doctor_code", None)
        _clear_patient_doctor(patient)
    elif "doctor_code" in update_data:
        doctor = await _resolve_doctor_code(update_data["doctor_code"])

    _apply_patient_payload(patient, update_data, doctor)

    await db.flush()
    await db.refresh(patient)
    return PatientResponse.model_validate(patient)
