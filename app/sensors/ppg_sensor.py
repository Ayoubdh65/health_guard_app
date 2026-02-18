"""
HealthGuard Edge Node – Real PPG / I2C Sensor Reader (Stub).

This module provides the interface for reading from a real PPG heart rate
sensor connected via I2C on a Raspberry Pi. It will raise a clear error
if the required hardware libraries are not installed.
"""

import asyncio
import logging
from typing import List, Optional

from app.sensors.sensor_interface import SensorReader, SensorData

logger = logging.getLogger(__name__)


class PPGSensor(SensorReader):
    """
    Real PPG sensor reader using smbus2 (I2C).

    Designed for MAX30102 / MAX30105 pulse oximeter breakout boards.
    Requires: smbus2, RPi.GPIO (installed on Raspberry Pi OS).
    """

    I2C_ADDRESS = 0x57  # Default MAX30102 address
    I2C_BUS = 1         # Raspberry Pi I2C bus 1

    def __init__(self) -> None:
        self._available = False
        self._bus = None

    async def initialize(self) -> None:
        """Attempt to open the I2C bus and verify sensor presence."""
        try:
            import smbus2  # type: ignore
            self._bus = smbus2.SMBus(self.I2C_BUS)
            # Probe the sensor – read the part ID register
            part_id = self._bus.read_byte_data(self.I2C_ADDRESS, 0xFF)
            logger.info(f"PPG sensor detected on I2C bus {self.I2C_BUS}, part ID: 0x{part_id:02X}")
            self._available = True
        except ImportError:
            logger.error(
                "smbus2 not installed. Install with: pip install smbus2\n"
                "This package is only available on Linux / Raspberry Pi."
            )
            raise RuntimeError("smbus2 library not available – cannot use real sensor")
        except FileNotFoundError:
            logger.error(
                f"I2C bus {self.I2C_BUS} not found. Ensure I2C is enabled:\n"
                "  sudo raspi-config → Interface Options → I2C → Enable"
            )
            raise RuntimeError("I2C bus not available")
        except OSError as exc:
            logger.error(f"Could not communicate with sensor at 0x{self.I2C_ADDRESS:02X}: {exc}")
            raise RuntimeError(f"Sensor not responding: {exc}")

    async def read(self) -> SensorData:
        """
        Read vitals from the hardware sensor.

        NOTE: This is a simplified stub. A production implementation would
        use the full MAX30102 driver to capture red/IR LED data, compute
        heart rate via peak detection, and derive SpO₂ from the R-value.
        """
        if not self._available or self._bus is None:
            raise RuntimeError("Sensor not initialized")

        # Placeholder – in production replace with actual register reads
        # and signal-processing pipeline.
        await asyncio.sleep(0.5)  # simulate sampling time

        logger.warning(
            "PPGSensor.read() is a stub. Implement full MAX30102 driver "
            "for production use."
        )

        return SensorData(
            heart_rate=None,
            spo2=None,
            temperature=None,
        )

    async def shutdown(self) -> None:
        """Close the I2C bus."""
        if self._bus is not None:
            self._bus.close()
            self._bus = None
        self._available = False

    @property
    def is_available(self) -> bool:
        return self._available
