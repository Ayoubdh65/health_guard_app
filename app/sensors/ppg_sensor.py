import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import List

from app.sensors.sensor_interface import SensorReader, SensorData

logger = logging.getLogger(__name__)


class PPGSensor(SensorReader):
    I2C_ADDRESS = 0x57
    I2C_BUS = 1

    REG_FIFO_DATA = 0x07
    REG_MODE_CONFIG = 0x09
    REG_SPO2_CONFIG = 0x0A
    REG_LED1_PA = 0x0C
    REG_LED2_PA = 0x0D
    REG_PART_ID = 0xFF

    SAMPLE_DELAY = 0.04
    SAMPLE_RATE = 1 / SAMPLE_DELAY

    BUFFER_SIZE = 200   # increased for stability
    REFRESH_SAMPLES = 25

    FINGER_DETECT_THRESHOLD = 20000
    SIGNAL_P2P_MIN = 800   # relaxed

    VALUE_SMOOTHING_WINDOW = 3
    READING_HOLD_SECONDS = 15

    def __init__(self) -> None:
        self._available = False
        self._bus = None

        self._red_buffer: list[int] = []
        self._ir_buffer: list[int] = []

        self._recent_heart_rates: list[float] = []
        self._recent_spo2_values: list[float] = []

        self._last_valid_heart_rate: float | None = None
        self._last_valid_spo2: float | None = None

        self._last_valid_heart_rate_at: datetime | None = None
        self._last_valid_spo2_at: datetime | None = None

    async def initialize(self) -> None:
        try:
            import smbus2  # type: ignore

            self._bus = smbus2.SMBus(self.I2C_BUS)

            part_id = self._bus.read_byte_data(self.I2C_ADDRESS, self.REG_PART_ID)
            logger.info(f"MAX30102 detected (part id={hex(part_id)})")

            # reset
            self._bus.write_byte_data(self.I2C_ADDRESS, self.REG_MODE_CONFIG, 0x40)
            await asyncio.sleep(0.2)

            # config
            self._bus.write_byte_data(self.I2C_ADDRESS, self.REG_SPO2_CONFIG, 0x27)
            self._bus.write_byte_data(self.I2C_ADDRESS, self.REG_LED1_PA, 0x24)
            self._bus.write_byte_data(self.I2C_ADDRESS, self.REG_LED2_PA, 0x24)
            self._bus.write_byte_data(self.I2C_ADDRESS, self.REG_MODE_CONFIG, 0x03)

            self._available = True
            logger.info("MAX30102 initialized")

        except Exception as e:
            logger.error(f"Sensor init failed: {e}")
            raise

    async def read(self) -> SensorData:
        if not self._available or self._bus is None:
            raise RuntimeError("Sensor not initialized")

        await self._collect_samples()
        timestamp = datetime.now(timezone.utc)

        ir_dc = self._mean(self._ir_buffer)

        if ir_dc < self.FINGER_DETECT_THRESHOLD:
            self._reset_estimates()
            return SensorData(
                timestamp=timestamp,
                heart_rate=None,
                spo2=None,
                ppg_raw=self._normalized_waveform(),
            )

        heart_rate = self._calculate_heart_rate(self._ir_buffer, self.SAMPLE_RATE)
        spo2 = self._calculate_spo2(self._red_buffer, self._ir_buffer)

        heart_rate = self._stabilize_value(
            heart_rate, self._recent_heart_rates, timestamp, "heart_rate"
        )
        spo2 = self._stabilize_value(
            spo2, self._recent_spo2_values, timestamp, "spo2"
        )

        return SensorData(
            timestamp=timestamp,
            heart_rate=heart_rate,
            spo2=spo2,
            ppg_raw=self._normalized_waveform(),
        )

    async def shutdown(self) -> None:
        if self._bus:
            self._bus.close()
        self._available = False

    # ---------------- SIGNAL PROCESSING ---------------- #

    def _bandpass_filter(self, data: list[float]) -> list[float]:
        hp = [data[i] - data[i - 1] if i > 0 else 0 for i in range(len(data))]
        window = 4
        return [
            sum(hp[max(0, i - window): i + 1]) / len(hp[max(0, i - window): i + 1])
            for i in range(len(hp))
        ]

    def _calculate_heart_rate(self, ir_buffer: List[int], sample_rate: float) -> float | None:
        if len(ir_buffer) < 30:
            return self._last_valid_heart_rate

        signal = self._bandpass_filter(self._remove_dc(ir_buffer))
        p2p = self._peak_to_peak(signal)

        if p2p < self.SIGNAL_P2P_MIN:
            return self._last_valid_heart_rate

        mean = self._mean(signal)
        std = (sum((x - mean) ** 2 for x in signal) / len(signal)) ** 0.5
        threshold = mean + 0.5 * std

        min_distance = int(sample_rate * 0.4)
        peaks = []

        for i in range(2, len(signal) - 2):
            if signal[i] > threshold and signal[i] > signal[i - 1] and signal[i] > signal[i + 1]:
                if not peaks or (i - peaks[-1]) > min_distance:
                    peaks.append(i)

        if len(peaks) < 2:
            return self._last_valid_heart_rate

        intervals = [peaks[i + 1] - peaks[i] for i in range(len(peaks) - 1)]
        intervals.sort()
        median_interval = intervals[len(intervals) // 2]

        if median_interval <= 0:
            return self._last_valid_heart_rate

        bpm = (sample_rate / median_interval) * 60

        if not (40 <= bpm <= 200):
            return self._last_valid_heart_rate

        if self._last_valid_heart_rate and abs(bpm - self._last_valid_heart_rate) > 20:
            return self._last_valid_heart_rate

        return round(bpm, 1)

    def _calculate_spo2(self, red_buffer: List[int], ir_buffer: List[int]) -> float | None:
        red_dc = self._mean(red_buffer)
        ir_dc = self._mean(ir_buffer)

        red_ac = self._peak_to_peak(self._bandpass_filter(self._remove_dc(red_buffer)))
        ir_ac = self._peak_to_peak(self._bandpass_filter(self._remove_dc(ir_buffer)))

        if red_dc <= 0 or ir_dc <= 0 or red_ac <= 0 or ir_ac <= 0:
            return self._last_valid_spo2

        ratio = (red_ac / red_dc) / (ir_ac / ir_dc)
        spo2 = 104 - 17 * ratio

        if 70 <= spo2 <= 100:
            return round(spo2, 1)

        return self._last_valid_spo2

    # ---------------- UTILITIES ---------------- #

    def _normalized_waveform(self) -> list[float]:
        if not self._ir_buffer:
            return []
        signal = self._bandpass_filter(self._remove_dc(self._ir_buffer))
        return [round(v, 4) for v in signal[-50:]]

    @staticmethod
    def _mean(data: List[float]) -> float:
        return sum(data) / len(data) if data else 0.0

    @staticmethod
    def _remove_dc(data: List[float]) -> list[float]:
        avg = sum(data) / len(data)
        return [x - avg for x in data]

    @staticmethod
    def _peak_to_peak(data: List[float]) -> float:
        return max(data) - min(data) if data else 0.0

    def _stabilize_value(self, value, history, timestamp, value_type):
        if value is not None:
            history.append(value)
            if len(history) > self.VALUE_SMOOTHING_WINDOW:
                history.pop(0)

            value = round(self._mean(history), 1)

            if value_type == "heart_rate":
                self._last_valid_heart_rate = value
                self._last_valid_heart_rate_at = timestamp
            else:
                self._last_valid_spo2 = value
                self._last_valid_spo2_at = timestamp

            return value

        last_time = (
            self._last_valid_heart_rate_at
            if value_type == "heart_rate"
            else self._last_valid_spo2_at
        )

        if last_time and (timestamp - last_time) <= timedelta(seconds=self.READING_HOLD_SECONDS):
            return (
                self._last_valid_heart_rate
                if value_type == "heart_rate"
                else self._last_valid_spo2
            )

        return None

    def _reset_estimates(self):
        self._recent_heart_rates.clear()
        self._recent_spo2_values.clear()
        self._last_valid_heart_rate = None
        self._last_valid_spo2 = None
        self._last_valid_heart_rate_at = None
        self._last_valid_spo2_at = None