"""
HealthGuard Edge Node – Patient API Routes.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
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
    result = await db.execute(select(Patient).limit(1))
    patient = result.scalar_one_or_none()

    if patient is None:
        patient = Patient(**payload.model_dump())
        db.add(patient)
        await db.flush()
        await db.refresh(patient)
        return PatientResponse.model_validate(patient)

    if not _is_placeholder_patient(patient):
        raise HTTPException(
            status_code=409,
            detail="A patient profile is already registered on this device",
        )

    for key, value in payload.model_dump().items():
        setattr(patient, key, value)

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
    for key, value in update_data.items():
        setattr(patient, key, value)

    await db.flush()
    await db.refresh(patient)
    return PatientResponse.model_validate(patient)
