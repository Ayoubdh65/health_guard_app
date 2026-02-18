import React, { useState } from 'react';
import {
    Heart,
    Droplets,
    Thermometer,
    Activity,
    Wind,
    Shield,
} from 'lucide-react';

import VitalCard from './components/VitalCard';
import VitalChart from './components/VitalChart';
import PatientInfo from './components/PatientInfo';
import SystemStatus from './components/SystemStatus';
import {
    useLatestVital,
    useVitalStream,
    usePatient,
    useSystemStatus,
} from './hooks/useHealthData';

export default function App() {
    const { data: latest, loading: vitalsLoading } = useLatestVital(5000);
    const streamData = useVitalStream(60);
    const { patient, loading: patientLoading } = usePatient();
    const { status, loading: systemLoading } = useSystemStatus(10000);

    const [chartVitals, setChartVitals] = useState(['heart_rate', 'spo2']);

    const vitalOptions = [
        { key: 'heart_rate', label: 'HR' },
        { key: 'spo2', label: 'SpO₂' },
        { key: 'temperature', label: 'Temp' },
        { key: 'blood_pressure_sys', label: 'BP' },
        { key: 'respiratory_rate', label: 'RR' },
    ];

    const toggleChartVital = (key) => {
        setChartVitals((prev) =>
            prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
        );
    };

    return (
        <div className="min-h-screen">
            {/* ── Header ──────────────────────────────────────────────────── */}
            <header className="border-b border-gray-800/50 bg-gray-950/80 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg shadow-brand-500/20">
                            <Shield className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight text-white">
                                Health<span className="text-brand-400">Guard</span>
                            </h1>
                            <p className="text-xs text-gray-500 -mt-0.5">Edge Node Monitor</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-900/60 border border-gray-800/50">
                            <span className="status-dot-active" />
                            <span className="text-xs text-emerald-400 font-medium">Monitoring</span>
                        </div>
                        {status?.device_id && (
                            <span className="text-xs text-gray-600 font-mono hidden sm:block">
                                {status.device_id}
                            </span>
                        )}
                    </div>
                </div>
            </header>

            {/* ── Main Content ────────────────────────────────────────────── */}
            <main className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">

                {/* Vital Cards Grid */}
                <section>
                    <h2 className="text-sm font-medium text-gray-500 mb-3 uppercase tracking-wider">
                        Current Vitals
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <VitalCard
                            label="Heart Rate"
                            value={latest?.heart_rate}
                            unit="bpm"
                            icon={Heart}
                            color="text-vital-heart"
                            bgColor="bg-vital-heart"
                            alert={{ low: 50, high: 120 }}
                        />
                        <VitalCard
                            label="SpO₂"
                            value={latest?.spo2}
                            unit="%"
                            icon={Droplets}
                            color="text-vital-spo2"
                            bgColor="bg-vital-spo2"
                            alert={{ low: 90, high: 101 }}
                        />
                        <VitalCard
                            label="Temperature"
                            value={latest?.temperature}
                            unit="°C"
                            icon={Thermometer}
                            color="text-vital-temp"
                            bgColor="bg-vital-temp"
                            alert={{ low: 35.5, high: 38.0 }}
                        />
                        <VitalCard
                            label="BP Systolic"
                            value={latest?.blood_pressure_sys}
                            unit="mmHg"
                            icon={Activity}
                            color="text-vital-bp"
                            bgColor="bg-vital-bp"
                            alert={{ low: 90, high: 140 }}
                        />
                        <VitalCard
                            label="BP Diastolic"
                            value={latest?.blood_pressure_dia}
                            unit="mmHg"
                            icon={Activity}
                            color="text-purple-400"
                            bgColor="bg-purple-500"
                            alert={{ low: 60, high: 90 }}
                        />
                        <VitalCard
                            label="Resp. Rate"
                            value={latest?.respiratory_rate}
                            unit="br/min"
                            icon={Wind}
                            color="text-vital-rr"
                            bgColor="bg-vital-rr"
                            alert={{ low: 10, high: 25 }}
                        />
                    </div>
                </section>

                {/* Chart + Sidebar Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Chart Area */}
                    <div className="lg:col-span-2 space-y-4">
                        {/* Chart vital toggles */}
                        <div className="flex flex-wrap gap-2">
                            {vitalOptions.map(({ key, label }) => (
                                <button
                                    key={key}
                                    onClick={() => toggleChartVital(key)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border ${chartVitals.includes(key)
                                            ? 'bg-brand-600/20 border-brand-500/40 text-brand-300'
                                            : 'bg-gray-900/40 border-gray-800/50 text-gray-500 hover:text-gray-300 hover:border-gray-700/60'
                                        }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        <VitalChart data={streamData} visibleVitals={chartVitals} height={380} />
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        <PatientInfo patient={patient} loading={patientLoading} />
                        <SystemStatus status={status} loading={systemLoading} />
                    </div>
                </div>
            </main>

            {/* ── Footer ──────────────────────────────────────────────────── */}
            <footer className="border-t border-gray-800/30 mt-12 py-6">
                <div className="max-w-[1600px] mx-auto px-6 flex items-center justify-between text-xs text-gray-700">
                    <span>HealthGuard Edge Node v1.0.0</span>
                    <span>Raspberry Pi 8GB • {status?.mock_mode ? 'Mock Sensors' : 'Hardware Sensors'}</span>
                </div>
            </footer>
        </div>
    );
}
