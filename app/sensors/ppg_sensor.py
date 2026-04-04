"""
HealthGuard Edge Node – Real PPG / I2C Sensor Reader (Stub).

This module provides the interface for reading from a real PPG heart rate
sensor connected via I2C on a Raspberry Pi.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import List

from app.sensors.sensor_interface import SensorReader, SensorData

logger = logging.getLogger(__name__)


class PPGSensorStub(SensorReader):
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
        
        if not self._available or self._bus is None:
            raise RuntimeError("Sensor not initialized")

    
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


class PPGSensor(SensorReader):
    """Real MAX30102 reader backed by smbus2."""

    I2C_ADDRESS = 0x57
    I2C_BUS = 1

    REG_FIFO_WR_PTR = 0x04
    REG_OVF_COUNTER = 0x05
    REG_FIFO_RD_PTR = 0x06
    REG_FIFO_DATA = 0x07
    REG_FIFO_CONFIG = 0x08
    REG_MODE_CONFIG = 0x09
    REG_SPO2_CONFIG = 0x0A
    REG_LED1_PA = 0x0C
    REG_LED2_PA = 0x0D
    REG_PART_ID = 0xFF

    SAMPLE_DELAY = 0.04
    SAMPLE_RATE = 1 / SAMPLE_DELAY
    BUFFER_SIZE = 120
    REFRESH_SAMPLES = 25
    FINGER_DETECT_THRESHOLD = 20000
    SIGNAL_P2P_MIN = 1000

    def __init__(self) -> None:
        self._available = False
        self._bus = None
        self._red_buffer: list[int] = []
        self._ir_buffer: list[int] = []

    async def initialize(self) -> None:
        """Open the I2C bus and configure the MAX30102."""
        try:
            import smbus2  # type: ignore

            self._bus = smbus2.SMBus(self.I2C_BUS)
            part_id = self._read_byte(self.REG_PART_ID)
            if part_id != 0x15:
                raise RuntimeError(f"Wrong PART ID: {hex(part_id)}")

            logger.info(
                "MAX30102 detected on I2C bus %s (part id %s)",
                self.I2C_BUS,
                hex(part_id),
            )

            self._write_byte(self.REG_MODE_CONFIG, 0x40)
            await asyncio.sleep(0.2)

            self._write_byte(self.REG_FIFO_WR_PTR, 0x00)
            self._write_byte(self.REG_OVF_COUNTER, 0x00)
            self._write_byte(self.REG_FIFO_RD_PTR, 0x00)
            self._write_byte(self.REG_FIFO_CONFIG, 0x0F)
            self._write_byte(self.REG_SPO2_CONFIG, 0x27)
            self._write_byte(self.REG_LED1_PA, 0x24)
            self._write_byte(self.REG_LED2_PA, 0x24)
            self._write_byte(self.REG_MODE_CONFIG, 0x03)

            await asyncio.sleep(0.1)
            self._available = True
            logger.info("MAX30102 sensor initialized")
        except ImportError as exc:
            logger.error("smbus2 is required for the real MAX30102 sensor")
            raise RuntimeError("smbus2 library not available") from exc
        except FileNotFoundError as exc:
            logger.error("I2C bus %s not found. Enable I2C in raspi-config.", self.I2C_BUS)
            raise RuntimeError("I2C bus not available") from exc
        except OSError as exc:
            logger.error(
                "Could not communicate with MAX30102 at 0x%02X: %s",
                self.I2C_ADDRESS,
                exc,
            )
            raise RuntimeError(f"Sensor not responding: {exc}") from exc

    async def read(self) -> SensorData:
        """Collect samples and estimate heart rate and SpO2."""
        if not self._available or self._bus is None:
            raise RuntimeError("Sensor not initialized")

        await self._collect_samples()

        ir_dc = self._mean(self._ir_buffer)
        if ir_dc < self.FINGER_DETECT_THRESHOLD:
            logger.info("MAX30102: no finger detected")
            return SensorData(
                timestamp=datetime.now(timezone.utc),
                heart_rate=None,
                spo2=None,
                temperature=None,
                ppg_raw=self._normalized_waveform(),
            )

        heart_rate = self._calculate_heart_rate(self._ir_buffer, self.SAMPLE_RATE)
        spo2 = self._calculate_spo2(self._red_buffer, self._ir_buffer)

        if heart_rate is None or spo2 is None:
            logger.info(
                "MAX30102: signal captured but estimates are not stable yet "
                "(heart_rate=%s, spo2=%s)",
                heart_rate,
                spo2,
            )

        return SensorData(
            timestamp=datetime.now(timezone.utc),
            heart_rate=heart_rate,
            spo2=spo2,
            temperature=None,
            blood_pressure_sys=None,
            blood_pressure_dia=None,
            respiratory_rate=None,
            ppg_raw=self._normalized_waveform(),
        )

    async def shutdown(self) -> None:
        """Close the I2C bus."""
        if self._bus is not None:
            self._bus.close()
            self._bus = None
        self._available = False
        self._red_buffer.clear()
        self._ir_buffer.clear()

    @property
    def is_available(self) -> bool:
        return self._available

    def _read_byte(self, reg: int) -> int:
        return self._bus.read_byte_data(self.I2C_ADDRESS, reg)

    def _write_byte(self, reg: int, value: int) -> None:
        self._bus.write_byte_data(self.I2C_ADDRESS, reg, value)

    def _read_sample(self) -> tuple[int, int]:
        raw = self._bus.read_i2c_block_data(self.I2C_ADDRESS, self.REG_FIFO_DATA, 6)
        red = ((raw[0] & 0x03) << 16) | (raw[1] << 8) | raw[2]
        ir = ((raw[3] & 0x03) << 16) | (raw[4] << 8) | raw[5]
        return red, ir

    async def _collect_samples(self) -> None:
        samples_needed = (
            self.BUFFER_SIZE
            if len(self._ir_buffer) < self.BUFFER_SIZE
            else self.REFRESH_SAMPLES
        )

        for _ in range(samples_needed):
            red, ir = self._read_sample()
            self._red_buffer.append(red)
            self._ir_buffer.append(ir)

            if len(self._red_buffer) > self.BUFFER_SIZE:
                self._red_buffer.pop(0)
            if len(self._ir_buffer) > self.BUFFER_SIZE:
                self._ir_buffer.pop(0)

            await asyncio.sleep(self.SAMPLE_DELAY)

    def _normalized_waveform(self) -> list[float]:
        if not self._ir_buffer:
            return []
        centered = self._remove_dc(self._ir_buffer)
        return [round(value, 4) for value in centered[-50:]]

    @staticmethod
    def _mean(data: List[float]) -> float:
        return sum(data) / len(data) if data else 0.0

    @classmethod
    def _remove_dc(cls, data: List[float]) -> list[float]:
        avg = cls._mean(data)
        return [value - avg for value in data]

    @staticmethod
    def _peak_to_peak(data: List[float]) -> float:
        if not data:
            return 0.0
        return max(data) - min(data)

    def _calculate_heart_rate(self, ir_buffer: List[int], sample_rate: float) -> float | None:
        signal = self._remove_dc(ir_buffer)
        p2p = self._peak_to_peak(signal)

        if p2p < self.SIGNAL_P2P_MIN:
            return None

        threshold = p2p * 0.5
        min_distance = int(sample_rate * 0.45)
        peaks: list[int] = []

        for index in range(1, len(signal) - 1):
            if (
                signal[index] > threshold
                and signal[index] > signal[index - 1]
                and signal[index] > signal[index + 1]
            ):
                if not peaks or (index - peaks[-1]) >= min_distance:
                    peaks.append(index)

        if len(peaks) < 2:
            return None

        intervals = [peaks[i + 1] - peaks[i] for i in range(len(peaks) - 1)]
        avg_interval = self._mean(intervals)
        if avg_interval <= 0:
            return None

        bpm = (sample_rate / avg_interval) * 60
        if 40 <= bpm <= 200:
            return round(bpm, 1)
        return None

    def _calculate_spo2(self, red_buffer: List[int], ir_buffer: List[int]) -> float | None:
        red_dc = self._mean(red_buffer)
        ir_dc = self._mean(ir_buffer)
        red_ac = self._peak_to_peak(self._remove_dc(red_buffer))
        ir_ac = self._peak_to_peak(self._remove_dc(ir_buffer))

        if red_dc <= 0 or ir_dc <= 0 or red_ac <= 0 or ir_ac <= 0:
            return None

        ratio = (red_ac / red_dc) / (ir_ac / ir_dc)
        spo2 = 104 - 17 * ratio
        if 70 <= spo2 <= 100:
            return round(spo2, 1)
        return None
