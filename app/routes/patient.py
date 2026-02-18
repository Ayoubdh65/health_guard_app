"""
HealthGuard Edge Node – Patient API Routes.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.database import get_db
from app.database.models import Patient
from app.schemas import PatientResponse, PatientUpdate

router = APIRouter(prefix="/api/patient", tags=["Patient"])


@router.get("", response_model=PatientResponse)
async def get_patient(db: AsyncSession = Depends(get_db)):
    """Get the single patient profile on this edge node."""
    result = await db.execute(select(Patient).limit(1))
    patient = result.scalar_one_or_none()
    if patient is None:
        raise HTTPException(status_code=404, detail="No patient profile configured")
    return PatientResponse.model_validate(patient)


@router.put("", response_model=PatientResponse)
async def update_patient(
    payload: PatientUpdate,
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
