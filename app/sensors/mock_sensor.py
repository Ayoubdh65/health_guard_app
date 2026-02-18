"""
HealthGuard Edge Node – Mock Biomedical Sensor.

Generates realistic, fluctuating vital signs for testing without hardware.
Includes occasional anomaly injection to simulate real patient scenarios.
"""

import math
import random
import asyncio
from datetime import datetime, timezone
from typing import List, Optional

from app.sensors.sensor_interface import SensorReader, SensorData


class MockSensor(SensorReader):
    """Generates realistic biomedical data with natural variation."""

    def __init__(self) -> None:
        self._available = False
        self._tick = 0

        # ── Baseline vital ranges ──
        self._hr_base = 72.0        # Heart rate baseline (bpm)
        self._spo2_base = 97.5      # SpO₂ baseline (%)
        self._temp_base = 36.6      # Temperature baseline (°C)
        self._bp_sys_base = 120.0   # Systolic BP baseline (mmHg)
        self._bp_dia_base = 78.0    # Diastolic BP baseline (mmHg)
        self._rr_base = 16.0        # Respiratory rate baseline (breaths/min)

        # ── Anomaly probability ──
        self._anomaly_chance = 0.05  # 5 % chance per reading

    async def initialize(self) -> None:
        """Simulate sensor initialization delay."""
        await asyncio.sleep(0.1)
        self._available = True

    async def read(self) -> SensorData:
        """Generate one reading with natural variation and optional anomaly."""
        self._tick += 1
        t = self._tick

        is_anomaly = random.random() < self._anomaly_chance

        heart_rate = self._generate_vital(
            self._hr_base, noise_amp=3.0, wave_amp=5.0, period=60, t=t,
            anomaly=is_anomaly, anomaly_offset=random.choice([-20, 30]),
        )
        heart_rate = round(max(40.0, min(180.0, heart_rate)), 1)

        spo2 = self._generate_vital(
            self._spo2_base, noise_amp=0.3, wave_amp=0.8, period=90, t=t,
            anomaly=is_anomaly, anomaly_offset=-5,
        )
        spo2 = round(max(85.0, min(100.0, spo2)), 1)

        temperature = self._generate_vital(
            self._temp_base, noise_amp=0.05, wave_amp=0.2, period=120, t=t,
            anomaly=is_anomaly, anomaly_offset=1.5,
        )
        temperature = round(max(35.0, min(42.0, temperature)), 1)

        bp_sys = self._generate_vital(
            self._bp_sys_base, noise_amp=2.0, wave_amp=4.0, period=80, t=t,
            anomaly=is_anomaly, anomaly_offset=25,
        )
        bp_sys = round(max(80.0, min(200.0, bp_sys)), 1)

        bp_dia = self._generate_vital(
            self._bp_dia_base, noise_amp=1.5, wave_amp=3.0, period=80, t=t,
            anomaly=is_anomaly, anomaly_offset=15,
        )
        bp_dia = round(max(50.0, min(130.0, bp_dia)), 1)

        respiratory_rate = self._generate_vital(
            self._rr_base, noise_amp=1.0, wave_amp=2.0, period=100, t=t,
            anomaly=is_anomaly, anomaly_offset=8,
        )
        respiratory_rate = round(max(8.0, min(35.0, respiratory_rate)), 1)

        ppg_raw = self._generate_ppg_waveform(heart_rate)

        return SensorData(
            timestamp=datetime.now(timezone.utc),
            heart_rate=heart_rate,
            spo2=spo2,
            temperature=temperature,
            blood_pressure_sys=bp_sys,
            blood_pressure_dia=bp_dia,
            respiratory_rate=respiratory_rate,
            ppg_raw=ppg_raw,
        )

    async def shutdown(self) -> None:
        self._available = False

    @property
    def is_available(self) -> bool:
        return self._available

    # ── Private helpers ─────────────────────────────────────────────────

    @staticmethod
    def _generate_vital(
        base: float,
        noise_amp: float,
        wave_amp: float,
        period: int,
        t: int,
        anomaly: bool = False,
        anomaly_offset: float = 0,
    ) -> float:
        """Combine sinusoidal drift + Gaussian noise + optional anomaly."""
        value = base
        value += wave_amp * math.sin(2 * math.pi * t / period)
        value += random.gauss(0, noise_amp)
        if anomaly:
            value += anomaly_offset
        return value

    @staticmethod
    def _generate_ppg_waveform(heart_rate: float, samples: int = 50) -> List[float]:
        """Generate a synthetic PPG-like waveform segment."""
        freq = heart_rate / 60.0  # Hz
        waveform = []
        for i in range(samples):
            t = i / samples
            # Simplified PPG: main pulse + dicrotic notch
            pulse = math.exp(-((t % (1 / freq) * freq - 0.3) ** 2) / 0.01)
            notch = 0.3 * math.exp(-((t % (1 / freq) * freq - 0.55) ** 2) / 0.005)
            noise = random.gauss(0, 0.02)
            waveform.append(round(pulse + notch + noise, 4))
        return waveform
