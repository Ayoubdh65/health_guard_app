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
    CalendarClock,
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
import AppointmentNotifications from './components/AppointmentNotifications';
import PatientRegistrationCard from './components/PatientRegistrationCard';
import { getToken, getStoredUser, clearAuth, subscribeAlerts } from './api';
import {
    useLatestVital,
    useVitalStream,
    usePatient,
    useSystemStatus,
    useAlertStats,
    useAppointments,
    useAppointmentStats,
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
    { key: 'monitor', label: 'Monitor', shortLabel: 'Monitor', icon: Monitor },
    { key: 'history', label: 'History', shortLabel: 'History', icon: TrendingUp },
    { key: 'alerts', label: 'Alerts', shortLabel: 'Alerts', icon: Bell },
    { key: 'appointments', label: 'Notifications', shortLabel: 'Inbox', icon: CalendarClock },
];

function needsPatientRegistration(patient) {
    if (!patient) {
        return true;
    }

    const placeholderProfile = (
        patient.first_name === 'Default'
        && patient.last_name === 'Patient'
        && patient.medical_id === 'MED-000001'
        && !patient.doctor_id
    );

    return placeholderProfile || !patient.doctor_id;
}

function Dashboard({ currentUser, onLogout }) {
    const { theme, toggleTheme } = useTheme();
    const { data: latest, loading: vitalsLoading } = useLatestVital(5000);
    const streamData = useVitalStream(60);
    const {
        patient,
        loading: patientLoading,
        saving: patientSaving,
        saveProfile,
    } = usePatient();
    const { status, loading: systemLoading } = useSystemStatus(10000);
    const { stats: alertStats } = useAlertStats(8000);
    const {
        appointments,
        loading: appointmentsLoading,
        refresh: refreshAppointments,
        setAppointments,
    } = useAppointments(15000, false, 20);
    const {
        stats: appointmentStats,
        refresh: refreshAppointmentStats,
        setStats: setAppointmentStats,
    } = useAppointmentStats(15000);

    const [activeTab, setActiveTab] = useState('monitor');
    const [chartVitals, setChartVitals] = useState(['heart_rate', 'spo2']);
    const patientNeedsRegistration = !patientLoading && needsPatientRegistration(patient);

    // ── Toast notification state ────────────────────────────────────────
    const [toasts, setToasts] = useState([]);
    const toastIdRef = useRef(0);
    const knownAppointmentUuidsRef = useRef(new Set());
    const appointmentsLoadedRef = useRef(false);
    const MAX_TOASTS = 5;

    // Subscribe to real-time alert SSE stream
    useEffect(() => {
        const source = subscribeAlerts((alertData) => {
            toastIdRef.current += 1;
            const toast = { kind: 'alert', ...alertData, _toastId: toastIdRef.current };
            setToasts((prev) => {
                const next = [toast, ...prev];
                return next.length > MAX_TOASTS ? next.slice(0, MAX_TOASTS) : next;
            });
        });
        return () => source.close();
    }, []);

    useEffect(() => {
        if (appointmentsLoading) return;

        const unreadAppointments = appointments.filter((appointment) => !appointment.read_at);

        if (!appointmentsLoadedRef.current) {
            unreadAppointments.forEach((appointment) => knownAppointmentUuidsRef.current.add(appointment.uuid));
            appointmentsLoadedRef.current = true;
            return;
        }

        const newAppointments = unreadAppointments.filter(
            (appointment) => !knownAppointmentUuidsRef.current.has(appointment.uuid)
        );

        if (newAppointments.length > 0) {
            setToasts((prev) => {
                const nextToasts = newAppointments
                    .map((appointment) => {
                        toastIdRef.current += 1;
                        return { kind: 'appointment', ...appointment, _toastId: toastIdRef.current };
                    })
                    .reverse();
                const next = [...nextToasts, ...prev];
                return next.length > MAX_TOASTS ? next.slice(0, MAX_TOASTS) : next;
            });
        }

        unreadAppointments.forEach((appointment) => knownAppointmentUuidsRef.current.add(appointment.uuid));
    }, [appointments, appointmentsLoading]);

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

    const handleAppointmentRead = useCallback((updatedAppointment) => {
        if (!updatedAppointment?.uuid) {
            return;
        }

        setAppointments((prev) =>
            prev.map((appointment) =>
                appointment.uuid === updatedAppointment.uuid
                    ? { ...appointment, ...updatedAppointment }
                    : appointment
            )
        );

        if (updatedAppointment.read_at) {
            setAppointmentStats((prev) => ({
                ...prev,
                unread: Math.max(0, prev.unread - 1),
            }));
        }
    }, [setAppointments, setAppointmentStats]);

    return (
        <div className="min-h-screen">
            {/* ── Toast notifications (visible on all tabs) ──────────── */}
            <AlertToast
                toasts={toasts}
                onDismiss={dismissToast}
                onActionComplete={() => {
                    refreshAppointments();
                    refreshAppointmentStats();
                }}
            />
            {/* ── Header ──────────────────────────────────────────────────── */}
            <header className="border-b border-gray-200 dark:border-gray-800/50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl sticky top-0 z-50 transition-colors duration-300">
                <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3 sm:gap-4">
                    <div className="flex items-center gap-2.5 sm:gap-3 order-1 min-w-0">
                        <div className="p-2 sm:p-2.5 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg shadow-brand-500/20 shrink-0">
                            <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-gray-900 dark:text-white truncate">
                                Health<span className="text-brand-500 dark:text-brand-400">Guard</span>
                            </h1>
                            <p className="hidden sm:block text-xs text-gray-500 -mt-0.5">Edge Node Monitor</p>
                        </div>
                    </div>

                    {/* ── Navigation Tabs ────────────────────────────────── */}
                    <nav className="w-full sm:w-auto sm:flex-1 order-3 sm:order-2">
                        <div className="mobile-tab-strip sm:flex sm:items-center sm:justify-center sm:gap-1 sm:w-auto bg-gray-100/60 dark:bg-gray-900/50 rounded-xl p-1 border border-gray-200/50 dark:border-gray-800/40 transition-colors duration-300">
                        {TABS.map(({ key, label, shortLabel, icon: TabIcon }) => (
                            <button
                                key={key}
                                onClick={() => setActiveTab(key)}
                                className={`nav-tab ${activeTab === key ? 'nav-tab-active' : ''}`}
                            >
                                <TabIcon className="w-4 h-4" />
                                <span className="sm:hidden">{shortLabel}</span>
                                <span className="hidden sm:inline">{label}</span>
                                {key === 'alerts' && alertStats.unacknowledged > 0 && (
                                    <span className="badge-count">
                                        {alertStats.unacknowledged > 99 ? '99+' : alertStats.unacknowledged}
                                    </span>
                                )}
                                {key === 'appointments' && appointmentStats.unread > 0 && (
                                    <span className="badge-count">
                                        {appointmentStats.unread > 99 ? '99+' : appointmentStats.unread}
                                    </span>
                                )}
                            </button>
                        ))}
                        </div>
                    </nav>

                    <div className="flex items-center gap-1.5 sm:gap-3 order-2 sm:order-3 ml-auto">
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
                            className="p-2 rounded-xl text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 bg-gray-100/60 dark:bg-gray-900/50 border border-gray-200/50 dark:border-gray-800/40 hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-200 shrink-0"
                            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                        >
                            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        </button>

                        {/* User badge + Logout */}
                        <div className="flex items-center gap-1.5 sm:gap-2 ml-1 pl-2 sm:pl-3 border-l border-gray-200/50 dark:border-gray-800/50 shrink-0">
                            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                                <User className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline truncate max-w-[80px] sm:max-w-none">{currentUser?.username}</span>
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
                                {patientNeedsRegistration ? (
                                    <PatientRegistrationCard
                                        patient={patient}
                                        onSave={saveProfile}
                                        saving={patientSaving}
                                    />
                                ) : (
                                    <PatientInfo
                                        patient={patient}
                                        loading={patientLoading}
                                        onSave={saveProfile}
                                        saving={patientSaving}
                                    />
                                )}
                                <SystemStatus status={status} loading={systemLoading} />
                            </div>
                        </div>
                    </>
                )}

                {/* ── History Tab ──────────────────────────────────────── */}
                {activeTab === 'history' && <HistoryDashboard />}

                {/* ── Alerts Tab ───────────────────────────────────────── */}
                {activeTab === 'alerts' && <AlertsPanel />}

                {activeTab === 'appointments' && (
                    <AppointmentNotifications
                        appointments={appointments}
                        loading={appointmentsLoading}
                        unreadCount={appointmentStats.unread}
                        onMarkRead={handleAppointmentRead}
                        onRefresh={() => {
                            refreshAppointments();
                            refreshAppointmentStats();
                        }}
                    />
                )}
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
