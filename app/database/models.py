"""
HealthGuard Edge Node – SQLAlchemy ORM Models.

Stores biomedical data for a single patient on the edge device.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.database.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _generate_uuid() -> str:
    return str(uuid.uuid4())


# ── Patient ─────────────────────────────────────────────────────────────────

class Patient(Base):
    """Single-patient profile stored on this edge node."""

    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, autoincrement=True)
    uuid = Column(String(36), unique=True, nullable=False, default=_generate_uuid)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    date_of_birth = Column(String(10), nullable=True)          # ISO format YYYY-MM-DD
    medical_id = Column(String(50), unique=True, nullable=True)
    blood_type = Column(String(5), nullable=True)              # e.g. "A+", "O-"
    emergency_contact = Column(String(200), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    # Relationships
    vital_readings = relationship("VitalReading", back_populates="patient", cascade="all, delete-orphan")


# ── Vital Reading ───────────────────────────────────────────────────────────

class VitalReading(Base):
    """Individual biomedical sensor reading."""

    __tablename__ = "vital_readings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    uuid = Column(String(36), unique=True, nullable=False, default=_generate_uuid)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    timestamp = Column(DateTime(timezone=True), default=_utcnow, index=True)

    # ── Vital signs ──
    heart_rate = Column(Float, nullable=True)           # bpm
    spo2 = Column(Float, nullable=True)                 # % oxygen saturation
    temperature = Column(Float, nullable=True)          # °C
    blood_pressure_sys = Column(Float, nullable=True)   # mmHg systolic
    blood_pressure_dia = Column(Float, nullable=True)   # mmHg diastolic
    respiratory_rate = Column(Float, nullable=True)     # breaths per minute
    ppg_raw = Column(Text, nullable=True)               # raw PPG waveform (JSON array)

    # ── Sync tracking ──
    synced = Column(Boolean, default=False, index=True)
    synced_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    patient = relationship("Patient", back_populates="vital_readings")


# ── Sync Log ────────────────────────────────────────────────────────────────

class SyncLog(Base):
    """Audit trail for data synchronization attempts."""

    __tablename__ = "sync_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime(timezone=True), default=_utcnow)
    records_sent = Column(Integer, default=0)
    status = Column(String(20), nullable=False)  # "success", "partial", "failed"
    error_message = Column(Text, nullable=True)
    duration_ms = Column(Integer, nullable=True)
