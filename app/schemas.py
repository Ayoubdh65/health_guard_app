"""
HealthGuard Edge Node – Pydantic Schemas.

Request / response models for all REST API endpoints.
"""

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field


# ── Patient ─────────────────────────────────────────────────────────────────

class PatientBase(BaseModel):
    first_name: str = Field(..., max_length=100)
    last_name: str = Field(..., max_length=100)
    date_of_birth: Optional[str] = None
    medical_id: Optional[str] = None
    blood_type: Optional[str] = None
    emergency_contact: Optional[str] = None
    notes: Optional[str] = None


class PatientUpdate(BaseModel):
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    date_of_birth: Optional[str] = None
    medical_id: Optional[str] = None
    blood_type: Optional[str] = None
    emergency_contact: Optional[str] = None
    notes: Optional[str] = None


class PatientResponse(PatientBase):
    id: int
    uuid: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Vital Reading ───────────────────────────────────────────────────────────

class VitalReadingResponse(BaseModel):
    id: int
    uuid: str
    timestamp: datetime
    heart_rate: Optional[float] = None
    spo2: Optional[float] = None
    temperature: Optional[float] = None
    blood_pressure_sys: Optional[float] = None
    blood_pressure_dia: Optional[float] = None
    respiratory_rate: Optional[float] = None
    synced: bool

    model_config = {"from_attributes": True}


class VitalStats(BaseModel):
    period_start: datetime
    period_end: datetime
    total_readings: int
    heart_rate_avg: Optional[float] = None
    heart_rate_min: Optional[float] = None
    heart_rate_max: Optional[float] = None
    spo2_avg: Optional[float] = None
    spo2_min: Optional[float] = None
    spo2_max: Optional[float] = None
    temperature_avg: Optional[float] = None
    blood_pressure_sys_avg: Optional[float] = None
    blood_pressure_dia_avg: Optional[float] = None
    respiratory_rate_avg: Optional[float] = None


class VitalsPaginated(BaseModel):
    items: List[VitalReadingResponse]
    total: int
    page: int
    page_size: int
    pages: int


# ── System ──────────────────────────────────────────────────────────────────

class SystemStatus(BaseModel):
    device_id: str
    uptime_seconds: float
    database_size_mb: float
    total_readings: int
    unsynced_readings: int
    last_sync: Optional[datetime] = None
    last_sync_status: Optional[str] = None
    sensor_status: str
    mock_mode: bool


class SyncResult(BaseModel):
    status: str
    records_sent: int
    duration_ms: int
    error: Optional[str] = None


# ── Authentication ──────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=4)
    role: Optional[str] = "viewer"


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    uuid: str
    username: str
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
