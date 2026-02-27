"""
HealthGuard Edge Node – Anomaly Detection Engine.

Checks each sensor reading against configurable thresholds and generates
Alert records when vitals are outside safe ranges or sensors disconnect.
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database.database import async_session
from app.database.models import Alert
from app.sensors.sensor_interface import SensorData

logger = logging.getLogger(__name__)

# ── In-process alert event bus ──────────────────────────────────────────────
_alert_queues: list[asyncio.Queue] = []


def subscribe_alerts() -> asyncio.Queue:
    """Create a new queue that will receive alert dicts in real-time."""
    q: asyncio.Queue = asyncio.Queue()
    _alert_queues.append(q)
    return q


def unsubscribe_alerts(q: asyncio.Queue) -> None:
    """Remove a subscriber queue."""
    try:
        _alert_queues.remove(q)
    except ValueError:
        pass


def _broadcast_alert(alert_dict: dict) -> None:
    """Push an alert dict to every connected subscriber."""
    for q in _alert_queues:
        q.put_nowait(alert_dict)


# ── Threshold definitions ───────────────────────────────────────────────────

def _get_thresholds():
    """Build threshold check list from settings."""
    s = get_settings()
    return [
        {
            "vital": "heart_rate",
            "label": "Heart Rate",
            "unit": "bpm",
            "checks": [
                {"direction": "high", "threshold": s.ALERT_HR_HIGH, "severity": "warning"},
                {"direction": "low",  "threshold": s.ALERT_HR_LOW,  "severity": "warning"},
            ],
        },
        {
            "vital": "spo2",
            "label": "SpO₂",
            "unit": "%",
            "checks": [
                {"direction": "low", "threshold": s.ALERT_SPO2_LOW, "severity": "critical"},
            ],
        },
        {
            "vital": "temperature",
            "label": "Temperature",
            "unit": "°C",
            "checks": [
                {"direction": "high", "threshold": s.ALERT_TEMP_HIGH, "severity": "warning"},
                {"direction": "low",  "threshold": s.ALERT_TEMP_LOW,  "severity": "critical"},
            ],
        },
        {
            "vital": "blood_pressure_sys",
            "label": "BP Systolic",
            "unit": "mmHg",
            "checks": [
                {"direction": "high", "threshold": s.ALERT_BP_SYS_HIGH, "severity": "warning"},
                {"direction": "low",  "threshold": s.ALERT_BP_SYS_LOW,  "severity": "critical"},
            ],
        },
        {
            "vital": "blood_pressure_dia",
            "label": "BP Diastolic",
            "unit": "mmHg",
            "checks": [
                {"direction": "high", "threshold": s.ALERT_BP_DIA_HIGH, "severity": "warning"},
                {"direction": "low",  "threshold": s.ALERT_BP_DIA_LOW,  "severity": "warning"},
            ],
        },
        {
            "vital": "respiratory_rate",
            "label": "Respiratory Rate",
            "unit": "br/min",
            "checks": [
                {"direction": "high", "threshold": s.ALERT_RR_HIGH, "severity": "warning"},
                {"direction": "low",  "threshold": s.ALERT_RR_LOW,  "severity": "critical"},
            ],
        },
    ]


# ── Cooldown check ──────────────────────────────────────────────────────────

async def _is_on_cooldown(
    session: AsyncSession, patient_id: int, alert_type: str
) -> bool:
    """Return True if a similar alert was generated within the cooldown window."""
    settings = get_settings()
    cooldown_cutoff = datetime.now(timezone.utc) - timedelta(
        seconds=settings.ALERT_COOLDOWN_SECONDS
    )
    result = await session.execute(
        select(func.count(Alert.id))
        .where(Alert.patient_id == patient_id)
        .where(Alert.alert_type == alert_type)
        .where(Alert.timestamp >= cooldown_cutoff)
    )
    return (result.scalar() or 0) > 0


# ── Main check function ────────────────────────────────────────────────────

async def check_reading(
    data: SensorData,
    reading_id: int,
    patient_id: int,
) -> list[Alert]:
    """
    Analyse a sensor reading for anomalies.

    Returns a list of Alert ORM objects that have been persisted to the DB.
    """
    alerts_created: list[Alert] = []

    async with async_session() as session:
        # ── Check for sensor disconnect (all vitals None) ───────────
        vitals = [
            data.heart_rate, data.spo2, data.temperature,
            data.blood_pressure_sys, data.blood_pressure_dia,
            data.respiratory_rate,
        ]
        if all(v is None for v in vitals):
            alert_type = "sensor_disconnect"
            if not await _is_on_cooldown(session, patient_id, alert_type):
                alert = Alert(
                    patient_id=patient_id,
                    reading_id=reading_id,
                    severity="critical",
                    alert_type=alert_type,
                    vital_name=None,
                    vital_value=None,
                    threshold=None,
                    message="⚠️ Sensor disconnection detected — all vital readings are null.",
                )
                session.add(alert)
                alerts_created.append(alert)
                logger.warning("🚨 Alert: sensor_disconnect")
            await session.commit()
            return alerts_created

        # ── Check each vital against thresholds ─────────────────────
        for rule in _get_thresholds():
            value = getattr(data, rule["vital"], None)
            if value is None:
                continue

            for check in rule["checks"]:
                breached = False
                direction = check["direction"]
                threshold = check["threshold"]

                if direction == "high" and value > threshold:
                    breached = True
                    alert_type = f"high_{rule['vital']}"
                    msg = (
                        f"🚨 {rule['label']} is HIGH: {value} {rule['unit']} "
                        f"(threshold: {threshold} {rule['unit']})"
                    )
                elif direction == "low" and value < threshold:
                    breached = True
                    alert_type = f"low_{rule['vital']}"
                    msg = (
                        f"🚨 {rule['label']} is LOW: {value} {rule['unit']} "
                        f"(threshold: {threshold} {rule['unit']})"
                    )

                if breached and not await _is_on_cooldown(session, patient_id, alert_type):
                    alert = Alert(
                        patient_id=patient_id,
                        reading_id=reading_id,
                        severity=check["severity"],
                        alert_type=alert_type,
                        vital_name=rule["vital"],
                        vital_value=value,
                        threshold=threshold,
                        message=msg,
                    )
                    session.add(alert)
                    alerts_created.append(alert)
                    logger.warning(f"🚨 Alert: {alert_type} ({value} {rule['unit']})")

        await session.commit()

        # Broadcast each new alert to SSE subscribers
        for alert in alerts_created:
            await session.refresh(alert)
            _broadcast_alert({
                "id": alert.id,
                "severity": alert.severity,
                "alert_type": alert.alert_type,
                "vital_name": alert.vital_name,
                "vital_value": alert.vital_value,
                "threshold": alert.threshold,
                "message": alert.message,
                "timestamp": alert.timestamp.isoformat() if alert.timestamp else None,
                "acknowledged": alert.acknowledged,
            })

    return alerts_created
