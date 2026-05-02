import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple

from app.sensors.sensor_interface import SensorData, SensorReader

logger = logging.getLogger(__name__)


class PPGSensor(SensorReader):
    """MAX30102 pulse oximeter reader for Raspberry Pi I2C.

    The values produced here are suitable for wellness/demo telemetry, not for
    clinical decisions. MAX30102 SpO2 readings need mechanical stability and
    per-device calibration to become trustworthy.
    """

    I2C_ADDRESS = 0x57
    I2C_BUS = 1

    REG_INTR_STATUS_1 = 0x00
    REG_INTR_STATUS_2 = 0x01
    REG_INTR_ENABLE_1 = 0x02
    REG_INTR_ENABLE_2 = 0x03
    REG_FIFO_WR_PTR = 0x04
    REG_OVF_COUNTER = 0x05
    REG_FIFO_RD_PTR = 0x06
    REG_FIFO_DATA = 0x07
    REG_FIFO_CONFIG = 0x08
    REG_MODE_CONFIG = 0x09
    REG_SPO2_CONFIG = 0x0A
    REG_LED1_PA = 0x0C  # Red LED pulse amplitude
    REG_LED2_PA = 0x0D  # IR LED pulse amplitude
    REG_PART_ID = 0xFF

    EXPECTED_PART_ID = 0x15

    # REG_SPO2_CONFIG = 0x27 means ADC range 4096 nA, 100 Hz, 411 us pulse width.
    SAMPLE_RATE = 100.0
    SAMPLE_DELAY = 1.0 / SAMPLE_RATE

    BUFFER_SIZE = 300
    REFRESH_SAMPLES = 25
    MIN_ANALYSIS_SAMPLES = 100

    FINGER_DETECT_THRESHOLD = 12000
    SIGNAL_P2P_MIN = 250
    SIGNAL_P2P_MAX = 120000

    VALUE_SMOOTHING_WINDOW = 7
    READING_HOLD_SECONDS = 45

    MIN_BPM = 40.0
    MAX_BPM = 200.0
    MAX_BPM_JUMP = 35.0

    MISSING_FINGER_READS_TO_CLEAR = 8

    MIN_SPO2 = 70.0
    MAX_SPO2 = 100.0

    def __init__(self) -> None:
        self._available = False
        self._bus = None

        self._red_buffer: list[int] = []
        self._ir_buffer: list[int] = []

        self._recent_heart_rates: list[float] = []
        self._recent_spo2_values: list[float] = []

        self._last_valid_heart_rate: Optional[float] = None
        self._last_valid_spo2: Optional[float] = None

        self._last_valid_heart_rate_at: Optional[datetime] = None
        self._last_valid_spo2_at: Optional[datetime] = None
        self._missing_finger_reads = 0
    @property
    def is_available(self) -> bool:
        return self._available

    async def initialize(self) -> None:
        try:
            import smbus2  # type: ignore

            self._bus = smbus2.SMBus(self.I2C_BUS)

            part_id = self._bus.read_byte_data(self.I2C_ADDRESS, self.REG_PART_ID)
            if part_id != self.EXPECTED_PART_ID:
                raise RuntimeError(
                    f"Unexpected MAX30102 part id {hex(part_id)}; "
                    f"expected {hex(self.EXPECTED_PART_ID)}"
                )

            logger.info("MAX30102 detected (part id=%s)", hex(part_id))

            self._reset_device()
            await asyncio.sleep(0.2)

            self._configure_device()
            self._clear_fifo()
            self._clear_buffers()

            self._available = True
            logger.info("MAX30102 initialized")

        except Exception as exc:
            self._available = False
            if self._bus is not None:
                try:
                    self._bus.close()
                finally:
                    self._bus = None
            logger.exception("MAX30102 initialization failed: %s", exc)
            raise

    async def read(self) -> SensorData:
        if not self._available or self._bus is None:
            raise RuntimeError("Sensor not initialized")

        await self._collect_samples()
        timestamp = datetime.now(timezone.utc)

        if not self._finger_present():
            self._missing_finger_reads += 1
            if self._missing_finger_reads >= self.MISSING_FINGER_READS_TO_CLEAR:
                self._reset_estimates(clear_buffers=False)

            return SensorData(
                timestamp=timestamp,
                heart_rate=self._held_value(timestamp, "heart_rate"),
                spo2=self._held_value(timestamp, "spo2"),
                ppg_raw=self._normalized_waveform(),
            )

        self._missing_finger_reads = 0

        if self._signal_quality_ok():
            heart_rate = self._calculate_heart_rate(self._ir_buffer, self.SAMPLE_RATE)
            spo2 = self._calculate_spo2(self._red_buffer, self._ir_buffer)
        else:
            heart_rate = None
            spo2 = None

        heart_rate = self._stabilize_value(
            heart_rate,
            self._recent_heart_rates,
            timestamp,
            "heart_rate",
        )
        spo2 = self._stabilize_value(
            spo2,
            self._recent_spo2_values,
            timestamp,
            "spo2",
        )

        return SensorData(
            timestamp=timestamp,
            heart_rate=heart_rate,
            spo2=spo2,
            ppg_raw=self._normalized_waveform(),
        )

    async def shutdown(self) -> None:
        if self._bus is not None:
            try:
                self._bus.write_byte_data(self.I2C_ADDRESS, self.REG_MODE_CONFIG, 0x80)
            except Exception:
                logger.debug("Unable to put MAX30102 into shutdown mode", exc_info=True)
            finally:
                self._bus.close()
                self._bus = None

        self._available = False
        self._clear_buffers()
        self._reset_estimates(clear_buffers=False)

    # ---------------- HARDWARE ---------------- #

    def _reset_device(self) -> None:
        self._bus.write_byte_data(self.I2C_ADDRESS, self.REG_MODE_CONFIG, 0x40)

    def _configure_device(self) -> None:
        # Disable interrupts; this reader polls the FIFO.
        self._bus.write_byte_data(self.I2C_ADDRESS, self.REG_INTR_ENABLE_1, 0x00)
        self._bus.write_byte_data(self.I2C_ADDRESS, self.REG_INTR_ENABLE_2, 0x00)

        # Sample averaging = 4, FIFO rollover enabled, almost-full threshold = 15.
        self._bus.write_byte_data(self.I2C_ADDRESS, self.REG_FIFO_CONFIG, 0x4F)

        # SpO2 mode: red + IR.
        self._bus.write_byte_data(self.I2C_ADDRESS, self.REG_MODE_CONFIG, 0x03)

        # ADC range 4096 nA, sample rate 100 Hz, LED pulse width 411 us / 18-bit.
        self._bus.write_byte_data(self.I2C_ADDRESS, self.REG_SPO2_CONFIG, 0x27)

        # LED current. Increase carefully if finger DC level is too low.
        self._bus.write_byte_data(self.I2C_ADDRESS, self.REG_LED1_PA, 0x24)
        self._bus.write_byte_data(self.I2C_ADDRESS, self.REG_LED2_PA, 0x24)

        self._read_interrupt_status()

    def _clear_fifo(self) -> None:
        self._bus.write_byte_data(self.I2C_ADDRESS, self.REG_FIFO_WR_PTR, 0x00)
        self._bus.write_byte_data(self.I2C_ADDRESS, self.REG_OVF_COUNTER, 0x00)
        self._bus.write_byte_data(self.I2C_ADDRESS, self.REG_FIFO_RD_PTR, 0x00)
        self._read_interrupt_status()

    def _read_interrupt_status(self) -> None:
        self._bus.read_byte_data(self.I2C_ADDRESS, self.REG_INTR_STATUS_1)
        self._bus.read_byte_data(self.I2C_ADDRESS, self.REG_INTR_STATUS_2)

    async def _collect_samples(self) -> None:
        for _ in range(self.REFRESH_SAMPLES):
            red, ir = self._read_fifo_sample()
            self._append_sample(red, ir)
            await asyncio.sleep(self.SAMPLE_DELAY)

    def _read_fifo_sample(self) -> Tuple[int, int]:
        data = self._bus.read_i2c_block_data(self.I2C_ADDRESS, self.REG_FIFO_DATA, 6)

        red = ((data[0] << 16) | (data[1] << 8) | data[2]) & 0x03FFFF
        ir = ((data[3] << 16) | (data[4] << 8) | data[5]) & 0x03FFFF

        return red, ir

    def _append_sample(self, red: int, ir: int) -> None:
        self._red_buffer.append(red)
        self._ir_buffer.append(ir)

        if len(self._red_buffer) > self.BUFFER_SIZE:
            del self._red_buffer[: len(self._red_buffer) - self.BUFFER_SIZE]
        if len(self._ir_buffer) > self.BUFFER_SIZE:
            del self._ir_buffer[: len(self._ir_buffer) - self.BUFFER_SIZE]

    # ---------------- SIGNAL PROCESSING ---------------- #

    def _finger_present(self) -> bool:
        if len(self._ir_buffer) < self.MIN_ANALYSIS_SAMPLES:
            return False

        recent_ir = self._ir_buffer[-self.MIN_ANALYSIS_SAMPLES :]
        ir_dc = self._mean(recent_ir)
        return ir_dc >= self.FINGER_DETECT_THRESHOLD

    def _signal_quality_ok(self) -> bool:
        if len(self._ir_buffer) < self.MIN_ANALYSIS_SAMPLES:
            return False

        recent_ir = self._ir_buffer[-self.MIN_ANALYSIS_SAMPLES :]
        ir_signal = self._bandpass_filter(self._remove_dc(recent_ir))
        ir_p2p = self._peak_to_peak(ir_signal)
        return self.SIGNAL_P2P_MIN <= ir_p2p <= self.SIGNAL_P2P_MAX

    def _bandpass_filter(self, data: List[float]) -> list[float]:
        if not data:
            return []

        # Lightweight high-pass followed by moving average smoothing. This is
        # intentionally cheap enough for a Raspberry Pi polling loop.
        high_passed = [0.0]
        for index in range(1, len(data)):
            high_passed.append(data[index] - data[index - 1])

        window = 4
        filtered: list[float] = []
        for index in range(len(high_passed)):
            segment = high_passed[max(0, index - window) : index + 1]
            filtered.append(self._mean(segment))

        return filtered

    def _calculate_heart_rate(
        self,
        ir_buffer: List[int],
        sample_rate: float,
    ) -> Optional[float]:
        if len(ir_buffer) < self.MIN_ANALYSIS_SAMPLES:
            return None

        signal = self._bandpass_filter(self._remove_dc(ir_buffer[-self.BUFFER_SIZE :]))
        p2p = self._peak_to_peak(signal)

        if not (self.SIGNAL_P2P_MIN <= p2p <= self.SIGNAL_P2P_MAX):
            return None

        mean = self._mean(signal)
        std = self._std(signal, mean)
        if std <= 0:
            return None

        threshold = mean + 0.45 * std
        min_distance = int(sample_rate * 60.0 / self.MAX_BPM)
        max_distance = int(sample_rate * 60.0 / self.MIN_BPM)
        peaks: list[int] = []

        for index in range(2, len(signal) - 2):
            if signal[index] <= threshold:
                continue
            if signal[index] <= signal[index - 1] or signal[index] < signal[index + 1]:
                continue

            if peaks and (index - peaks[-1]) < min_distance:
                if signal[index] > signal[peaks[-1]]:
                    peaks[-1] = index
                continue

            peaks.append(index)

        if len(peaks) < 2:
            return None

        intervals = [
            peaks[index + 1] - peaks[index]
            for index in range(len(peaks) - 1)
            if min_distance <= peaks[index + 1] - peaks[index] <= max_distance
        ]
        if not intervals:
            return None

        median_interval = self._median(intervals)
        if median_interval <= 0:
            return None

        bpm = (sample_rate / median_interval) * 60.0
        if not (self.MIN_BPM <= bpm <= self.MAX_BPM):
            return None

        if (
            self._last_valid_heart_rate is not None
            and abs(bpm - self._last_valid_heart_rate) > self.MAX_BPM_JUMP
        ):
            return None

        return round(bpm, 1)

    def _calculate_spo2(
        self,
        red_buffer: List[int],
        ir_buffer: List[int],
    ) -> Optional[float]:
        if len(red_buffer) < self.MIN_ANALYSIS_SAMPLES or len(ir_buffer) < self.MIN_ANALYSIS_SAMPLES:
            return None

        red_recent = red_buffer[-self.BUFFER_SIZE :]
        ir_recent = ir_buffer[-self.BUFFER_SIZE :]

        red_dc = self._mean(red_recent)
        ir_dc = self._mean(ir_recent)
        red_ac = self._peak_to_peak(self._bandpass_filter(self._remove_dc(red_recent)))
        ir_ac = self._peak_to_peak(self._bandpass_filter(self._remove_dc(ir_recent)))

        if red_dc <= 0 or ir_dc <= 0 or red_ac <= 0 or ir_ac <= 0:
            return None

        ratio = (red_ac / red_dc) / (ir_ac / ir_dc)
        if ratio <= 0:
            return None

        # Common MAX3010x approximation. It is device/contact dependent.
        spo2 = 104.0 - 17.0 * ratio
        if self.MIN_SPO2 <= spo2 <= self.MAX_SPO2:
            return round(spo2, 1)

        return None

    # ---------------- UTILITIES ---------------- #

    def _normalized_waveform(self) -> list[float]:
        if not self._ir_buffer:
            return []

        signal = self._bandpass_filter(self._remove_dc(self._ir_buffer[-50:]))
        p2p = self._peak_to_peak(signal)
        if p2p <= 0:
            return [0.0 for _ in signal]

        low = min(signal)
        return [round(((value - low) / p2p) * 2.0 - 1.0, 4) for value in signal]

    def _clear_buffers(self) -> None:
        self._red_buffer.clear()
        self._ir_buffer.clear()

    @staticmethod
    def _mean(data: List[float]) -> float:
        return sum(data) / len(data) if data else 0.0

    @staticmethod
    def _median(data: List[float]) -> float:
        if not data:
            return 0.0

        sorted_data = sorted(data)
        midpoint = len(sorted_data) // 2
        if len(sorted_data) % 2:
            return float(sorted_data[midpoint])

        return (sorted_data[midpoint - 1] + sorted_data[midpoint]) / 2.0

    @staticmethod
    def _std(data: List[float], mean: Optional[float] = None) -> float:
        if not data:
            return 0.0

        center = mean if mean is not None else sum(data) / len(data)
        return (sum((value - center) ** 2 for value in data) / len(data)) ** 0.5

    @staticmethod
    def _remove_dc(data: List[float]) -> list[float]:
        if not data:
            return []

        avg = sum(data) / len(data)
        return [value - avg for value in data]

    @staticmethod
    def _peak_to_peak(data: List[float]) -> float:
        return max(data) - min(data) if data else 0.0

    def _stabilize_value(
        self,
        value: Optional[float],
        history: list[float],
        timestamp: datetime,
        value_type: str,
    ) -> Optional[float]:
        if value is not None:
            history.append(value)
            if len(history) > self.VALUE_SMOOTHING_WINDOW:
                del history[: len(history) - self.VALUE_SMOOTHING_WINDOW]

            smoothed_value = round(self._mean(history), 1)

            if value_type == "heart_rate":
                self._last_valid_heart_rate = smoothed_value
                self._last_valid_heart_rate_at = timestamp
            else:
                self._last_valid_spo2 = smoothed_value
                self._last_valid_spo2_at = timestamp

            return smoothed_value

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

    def _held_value(self, timestamp: datetime, value_type: str) -> Optional[float]:
        last_time = (
            self._last_valid_heart_rate_at
            if value_type == "heart_rate"
            else self._last_valid_spo2_at
        )
        if not last_time:
            return None

        if (timestamp - last_time) > timedelta(seconds=self.READING_HOLD_SECONDS):
            return None

        return (
            self._last_valid_heart_rate
            if value_type == "heart_rate"
            else self._last_valid_spo2
        )

    def _reset_estimates(self, clear_buffers: bool = False) -> None:
        self._recent_heart_rates.clear()
        self._recent_spo2_values.clear()
        self._last_valid_heart_rate = None
        self._last_valid_spo2 = None
        self._last_valid_heart_rate_at = None
        self._last_valid_spo2_at = None

        if clear_buffers:
            self._clear_buffers()
