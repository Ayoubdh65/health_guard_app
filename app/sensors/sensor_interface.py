"""
HealthGuard Edge Node – Abstract Sensor Interface.

All sensor readers (real or mock) implement this contract.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional, List


@dataclass
class SensorData:
    """Normalized reading from any biomedical sensor."""

    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    heart_rate: Optional[float] = None       # bpm
    spo2: Optional[float] = None             # %
    temperature: Optional[float] = None      # °C
    blood_pressure_sys: Optional[float] = None   # mmHg
    blood_pressure_dia: Optional[float] = None   # mmHg
    respiratory_rate: Optional[float] = None     # breaths/min
    ppg_raw: Optional[List[float]] = None        # raw PPG waveform samples


class SensorReader(ABC):
    """Base class for all sensor readers."""

    @abstractmethod
    async def initialize(self) -> None:
        """Set up hardware or mock resources."""
        ...

    @abstractmethod
    async def read(self) -> SensorData:
        """Perform a single sensor reading and return normalized data."""
        ...

    @abstractmethod
    async def shutdown(self) -> None:
        """Release hardware resources."""
        ...

    @property
    @abstractmethod
    def is_available(self) -> bool:
        """Whether the sensor is currently available and operational."""
        ...
