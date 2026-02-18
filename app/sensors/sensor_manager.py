"""
HealthGuard Edge Node – Sensor Manager.

Factory + background collection loop.  Selects mock or real sensor based
on config and continuously writes readings to the database.
"""

import asyncio
import json
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database.database import async_session
from app.database.models import Patient, VitalReading
from app.sensors.sensor_interface import SensorReader, SensorData

logger = logging.getLogger(__name__)

# Module-level reference so other parts of the app can check status
_active_reader: SensorReader | None = None
_collection_task: asyncio.Task | None = None


def get_sensor_reader() -> SensorReader | None:
    """Return the currently active sensor reader (or None)."""
    return _active_reader


def create_sensor_reader() -> SensorReader:
    """Factory: return mock or real sensor based on settings."""
    settings = get_settings()

    if settings.MOCK_MODE:
        from app.sensors.mock_sensor import MockSensor
        logger.info("🧪 Using MOCK sensor (set MOCK_MODE=false for real hardware)")
        return MockSensor()
    else:
        from app.sensors.ppg_sensor import PPGSensor
        logger.info("🔌 Using REAL PPG sensor via I2C")
        return PPGSensor()


async def _ensure_default_patient(session: AsyncSession) -> int:
    """Create a default patient if none exists; return its ID."""
    result = await session.execute(select(Patient).limit(1))
    patient = result.scalar_one_or_none()
    if patient is None:
        patient = Patient(
            first_name="Default",
            last_name="Patient",
            date_of_birth="1990-01-01",
            medical_id="MED-000001",
            blood_type="O+",
            emergency_contact="+1-555-0100",
            notes="Auto-created by HealthGuard edge node.",
        )
        session.add(patient)
        await session.commit()
        await session.refresh(patient)
        logger.info(f"Created default patient (ID={patient.id})")
    return patient.id


async def _persist_reading(data: SensorData, patient_id: int) -> None:
    """Write a SensorData object to the database."""
    async with async_session() as session:
        reading = VitalReading(
            patient_id=patient_id,
            timestamp=data.timestamp,
            heart_rate=data.heart_rate,
            spo2=data.spo2,
            temperature=data.temperature,
            blood_pressure_sys=data.blood_pressure_sys,
            blood_pressure_dia=data.blood_pressure_dia,
            respiratory_rate=data.respiratory_rate,
            ppg_raw=json.dumps(data.ppg_raw) if data.ppg_raw else None,
            synced=False,
        )
        session.add(reading)
        await session.commit()


async def _collection_loop(reader: SensorReader) -> None:
    """Continuously collect sensor data at the configured interval."""
    settings = get_settings()
    interval = settings.SENSOR_INTERVAL_SECONDS

    # Ensure we have a patient record
    async with async_session() as session:
        patient_id = await _ensure_default_patient(session)

    logger.info(f"📡 Sensor collection started (interval={interval}s)")

    while True:
        try:
            data = await reader.read()
            await _persist_reading(data, patient_id)
            logger.debug(
                f"Vitals recorded: HR={data.heart_rate} SpO₂={data.spo2} "
                f"Temp={data.temperature} BP={data.blood_pressure_sys}/{data.blood_pressure_dia}"
            )
        except Exception as exc:
            logger.error(f"Sensor read error: {exc}", exc_info=True)

        await asyncio.sleep(interval)


async def start_collection() -> None:
    """Initialize the sensor and start background collection."""
    global _active_reader, _collection_task

    reader = create_sensor_reader()
    await reader.initialize()
    _active_reader = reader

    _collection_task = asyncio.create_task(_collection_loop(reader))


async def stop_collection() -> None:
    """Stop background collection and release sensor resources."""
    global _active_reader, _collection_task

    if _collection_task is not None:
        _collection_task.cancel()
        try:
            await _collection_task
        except asyncio.CancelledError:
            pass
        _collection_task = None

    if _active_reader is not None:
        await _active_reader.shutdown()
        _active_reader = None

    logger.info("Sensor collection stopped")
