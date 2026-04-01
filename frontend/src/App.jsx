import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Heart,
    Droplets,
    Thermometer,
    Activity,
    Wind,
    Shield,
    LogOut,
    User,
    Bell,
    TrendingUp,
    Monitor,
    Sun,
    Moon,
} from 'lucide-react';

import ThemeProvider, { useTheme } from './components/ThemeProvider';
import LoginPage from './components/LoginPage';
import VitalCard from './components/VitalCard';
import VitalChart from './components/VitalChart';
import PatientInfo from './components/PatientInfo';
import SystemStatus from './components/SystemStatus';
import AlertsPanel from './components/AlertsPanel';
import HistoryDashboard from './components/HistoryDashboard';
import AlertToast from './components/AlertToast';
import { getToken, getStoredUser, clearAuth, subscribeAlerts } from './api';
import {
    useLatestVital,
    useVitalStream,
    usePatient,
    useSystemStatus,
    useAlertStats,
} from './hooks/useHealthData';

export default function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(!!getToken());
    const [currentUser, setCurrentUser] = useState(getStoredUser());

    // Listen for auto-logout events from api.js (401 responses)
    useEffect(() => {
        const handleLogout = () => {
            setIsAuthenticated(false);
            setCurrentUser(null);
        };
        window.addEventListener('hg:logout', handleLogout);
        return () => window.removeEventListener('hg:logout', handleLogout);
    }, []);

    const handleLogin = (data) => {
        setIsAuthenticated(true);
        setCurrentUser(data.user);
    };

    const handleLogout = () => {
        clearAuth();
        setIsAuthenticated(false);
        setCurrentUser(null);
    };

    return (
        <ThemeProvider>
            {!isAuthenticated ? (
                <LoginPage onLogin={handleLogin} />
            ) : (
                <Dashboard currentUser={currentUser} onLogout={handleLogout} />
            )}
        </ThemeProvider>
    );
}

// ── Dashboard (only rendered when authenticated) ───────────────────────────

const TABS = [
    { key: 'monitor', label: 'Monitor', icon: Monitor },
    { key: 'history', label: 'History', icon: TrendingUp },
    { key: 'alerts', label: 'Alerts', icon: Bell },
];

function Dashboard({ currentUser, onLogout }) {
    const { theme, toggleTheme } = useTheme();
    const { data: latest, loading: vitalsLoading } = useLatestVital(5000);
    const streamData = useVitalStream(60);
    const { patient, loading: patientLoading } = usePatient();
    const { status, loading: systemLoading } = useSystemStatus(10000);
    const { stats: alertStats } = useAlertStats(8000);

    const [activeTab, setActiveTab] = useState('monitor');
    const [chartVitals, setChartVitals] = useState(['heart_rate', 'spo2']);

    // ── Toast notification state ────────────────────────────────────────
    const [toasts, setToasts] = useState([]);
    const toastIdRef = useRef(0);
    const MAX_TOASTS = 5;

    // Subscribe to real-time alert SSE stream
    useEffect(() => {
        const source = subscribeAlerts((alertData) => {
            toastIdRef.current += 1;
            const toast = { ...alertData, _toastId: toastIdRef.current };
            setToasts((prev) => {
                const next = [toast, ...prev];
                return next.length > MAX_TOASTS ? next.slice(0, MAX_TOASTS) : next;
            });
        });
        return () => source.close();
    }, []);

    const dismissToast = useCallback((toastId) => {
        setToasts((prev) => prev.filter((t) => t._toastId !== toastId));
    }, []);

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
            {/* ── Toast notifications (visible on all tabs) ──────────── */}
            <AlertToast toasts={toasts} onDismiss={dismissToast} />
            {/* ── Header ──────────────────────────────────────────────────── */}
            <header className="border-b border-gray-200 dark:border-gray-800/50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl sticky top-0 z-50 transition-colors duration-300">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3 order-1">
                        <div className="p-2.5 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg shadow-brand-500/20">
                            <Shield className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
                                Health<span className="text-brand-500 dark:text-brand-400">Guard</span>
                            </h1>
                            <p className="text-xs text-gray-500 -mt-0.5">Edge Node Monitor</p>
                        </div>
                    </div>

                    {/* ── Navigation Tabs ────────────────────────────────── */}
                    <nav className="flex items-center justify-center gap-1 w-full sm:w-auto order-3 sm:order-2 bg-gray-100/60 dark:bg-gray-900/50 rounded-xl p-1 border border-gray-200/50 dark:border-gray-800/40 transition-colors duration-300">
                        {TABS.map(({ key, label, icon: TabIcon }) => (
                            <button
                                key={key}
                                onClick={() => setActiveTab(key)}
                                className={`nav-tab ${activeTab === key ? 'nav-tab-active' : ''}`}
                            >
                                <TabIcon className="w-4 h-4" />
                                <span>{label}</span>
                                {key === 'alerts' && alertStats.unacknowledged > 0 && (
                                    <span className="badge-count">
                                        {alertStats.unacknowledged > 99 ? '99+' : alertStats.unacknowledged}
                                    </span>
                                )}
                            </button>
                        ))}
                    </nav>

                    <div className="flex items-center gap-2 sm:gap-3 order-2 sm:order-3">
                        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100/60 dark:bg-gray-900/60 border border-gray-200/50 dark:border-gray-800/50 transition-colors duration-300">
                            <span className="status-dot-active" />
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Monitoring</span>
                        </div>
                        {status?.device_id && (
                            <span className="text-xs text-gray-400 dark:text-gray-600 font-mono hidden sm:block">
                                {status.device_id}
                            </span>
                        )}

                        {/* Theme toggle */}
                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-xl text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 bg-gray-100/60 dark:bg-gray-900/50 border border-gray-200/50 dark:border-gray-800/40 hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-200"
                            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                        >
                            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        </button>

                        {/* User badge + Logout */}
                        <div className="flex items-center gap-2 ml-1 pl-3 border-l border-gray-200/50 dark:border-gray-800/50">
                            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                                <User className="w-3.5 h-3.5" />
                                <span className="truncate max-w-[80px] sm:max-w-none">{currentUser?.username}</span>
                            </div>
                            <button
                                onClick={onLogout}
                                className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
                                title="Sign out"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* ── Main Content ────────────────────────────────────────────── */}
            <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">

                {/* ── Monitor Tab ──────────────────────────────────────── */}
                {activeTab === 'monitor' && (
                    <>
                        {/* Vital Cards Grid */}
                        <section>
                            <h2 className="text-sm font-medium text-gray-500 mb-3 uppercase tracking-wider">
                                Current Vitals
                            </h2>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                                <VitalCard
                                    label="Heart Rate"
                                    value={latest?.heart_rate}
                                    unit="bpm"
                                    icon={Heart}
                                    color="text-vital-heart"
                                    bgColor="bg-vital-heart"
                                    alert={{ low: 60, high: 100 }}
                                    vitalKey="heart_rate"
                                />
                                <VitalCard
                                    label="SpO₂"
                                    value={latest?.spo2}
                                    unit="%"
                                    icon={Droplets}
                                    color="text-vital-spo2"
                                    bgColor="bg-vital-spo2"
                                    alert={{ low: 95, high: 100 }}
                                    vitalKey="spo2"
                                />
                                <VitalCard
                                    label="Temperature"
                                    value={latest?.temperature}
                                    unit="°C"
                                    icon={Thermometer}
                                    color="text-vital-temp"
                                    bgColor="bg-vital-temp"
                                    alert={{ low: 36.1, high: 37.2 }}
                                    vitalKey="temperature"
                                />
                                <VitalCard
                                    label="BP Systolic"
                                    value={latest?.blood_pressure_sys}
                                    unit="mmHg"
                                    icon={Activity}
                                    color="text-vital-bp"
                                    bgColor="bg-vital-bp"
                                    alert={{ low: 90, high: 120 }}
                                    vitalKey="blood_pressure_sys"
                                />
                                <VitalCard
                                    label="BP Diastolic"
                                    value={latest?.blood_pressure_dia}
                                    unit="mmHg"
                                    icon={Activity}
                                    color="text-purple-400"
                                    bgColor="bg-purple-500"
                                    alert={{ low: 60, high: 80 }}
                                    vitalKey="blood_pressure_dia"
                                />
                                <VitalCard
                                    label="Resp. Rate"
                                    value={latest?.respiratory_rate}
                                    unit="br/min"
                                    icon={Wind}
                                    color="text-vital-rr"
                                    bgColor="bg-vital-rr"
                                    alert={{ low: 12, high: 20 }}
                                    vitalKey="respiratory_rate"
                                />
                            </div>
                        </section>

                        {/* Chart + Sidebar Layout */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                            {/* Chart Area */}
                            <div className="lg:col-span-2 space-y-3 sm:space-y-4">
                                {/* Chart vital toggles */}
                                <div className="flex flex-wrap gap-2">
                                    {vitalOptions.map(({ key, label }) => (
                                        <button
                                            key={key}
                                            onClick={() => toggleChartVital(key)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border ${chartVitals.includes(key)
                                                ? 'bg-brand-500/15 dark:bg-brand-600/20 border-brand-400/40 dark:border-brand-500/40 text-brand-600 dark:text-brand-300'
                                                : 'bg-gray-100/60 dark:bg-gray-900/40 border-gray-200/50 dark:border-gray-800/50 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-700/60'
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
                    </>
                )}

                {/* ── History Tab ──────────────────────────────────────── */}
                {activeTab === 'history' && <HistoryDashboard />}

                {/* ── Alerts Tab ───────────────────────────────────────── */}
                {activeTab === 'alerts' && <AlertsPanel />}
            </main>

            {/* ── Footer ──────────────────────────────────────────────────── */}
            <footer className="border-t border-gray-200/50 dark:border-gray-800/30 mt-8 sm:mt-12 py-4 sm:py-6 transition-colors duration-300">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-0 text-xs text-gray-400 dark:text-gray-700 text-center sm:text-left">
                    <span>HealthGuard Edge Node v1.0.0</span>
                    <span>Raspberry Pi 8GB • {status?.mock_mode ? 'Mock Sensors' : 'Hardware Sensors'}</span>
                </div>
            </footer>
        </div>
    );
}
