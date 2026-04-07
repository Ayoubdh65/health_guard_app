import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, ShieldAlert, CheckCircle, X, Clock, CalendarClock, MapPin } from 'lucide-react';
import { api } from '../api';
import { formatThresholdExplanation, friendlySeverityLabel, getVitalStatus } from '../vitalUtils';

const SEVERITY_CONFIG = {
    critical: {
        icon: ShieldAlert,
        gradient: 'from-red-500/20 to-red-900/10',
        border: 'border-red-500/40',
        glow: 'shadow-red-500/20',
        text: 'text-red-500 dark:text-red-400',
        badge: 'bg-red-500/20 text-red-500 dark:text-red-400',
        bar: 'bg-red-500',
    },
    warning: {
        icon: AlertTriangle,
        gradient: 'from-amber-500/20 to-amber-900/10',
        border: 'border-amber-500/40',
        glow: 'shadow-amber-500/20',
        text: 'text-amber-500 dark:text-amber-400',
        badge: 'bg-amber-500/20 text-amber-500 dark:text-amber-400',
        bar: 'bg-amber-500',
    },
};

const APPOINTMENT_CONFIG = {
    gradient: 'from-brand-500/20 to-cyan-900/10',
    border: 'border-brand-500/40',
    glow: 'shadow-brand-500/20',
    text: 'text-brand-500 dark:text-brand-400',
    badge: 'bg-brand-500/15 text-brand-600 dark:text-brand-300',
    bar: 'bg-brand-500',
};

// ── Alert sound using Web Audio API ────────────────────────────────────────

function playAlertSound(severity = 'warning') {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const isCritical = severity === 'critical';

        const now = ctx.currentTime;

        if (isCritical) {
            // 🚨 CRITICAL: fast double pulse (like hospital monitor)
            for (let i = 0; i < 2; i++) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.type = 'triangle';
                osc.frequency.value = 900;

                const start = now + i * 0.25;

                gain.gain.setValueAtTime(0, start);
                gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);

                osc.start(start);
                osc.stop(start + 0.2);
            }

        } else {
            // ⚠️ WARNING: soft clean tone
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = 'sine';
            osc.frequency.value = 600;

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.15, now + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

            osc.start(now);
            osc.stop(now + 0.3);
        }

        setTimeout(() => ctx.close(), 1000);

    } catch {
        // silent fail
    }
}

function playAppointmentSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(740, now);
        osc.frequency.linearRampToValueAtTime(880, now + 0.18);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        osc.start(now);
        osc.stop(now + 0.5);

        setTimeout(() => ctx.close(), 1000);
    } catch {
        // silent fail
    }
}

function timeAgo(timestamp) {
    if (!timestamp) return '';
    const now = new Date();
    const then = new Date(timestamp);
    const diff = Math.floor((now - then) / 1000);

    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

function formatAppointmentDate(timestamp) {
    if (!timestamp) return '';
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(timestamp));
}

function AppointmentToast({ appointment, onDismiss, onActionComplete }) {
    const [exiting, setExiting] = useState(false);
    const [markingRead, setMarkingRead] = useState(false);
    const timerRef = useRef(null);

    useEffect(() => {
        timerRef.current = setTimeout(() => {
            setExiting(true);
            setTimeout(() => onDismiss(appointment._toastId), 400);
        }, 14000);

        return () => clearTimeout(timerRef.current);
    }, [appointment._toastId, onDismiss]);

    const handleDismiss = () => {
        clearTimeout(timerRef.current);
        setExiting(true);
        setTimeout(() => onDismiss(appointment._toastId), 400);
    };

    const handleMarkRead = async () => {
        if (!appointment.uuid) return;
        setMarkingRead(true);

        try {
            await api.markAppointmentRead(appointment.uuid);
            onActionComplete?.();
            handleDismiss();
        } catch {
            setMarkingRead(false);
        }
    };

    return (
        <div
            className={`toast-notification ${exiting ? 'toast-exit' : 'toast-enter'}
                bg-gradient-to-r ${APPOINTMENT_CONFIG.gradient}
                border ${APPOINTMENT_CONFIG.border} shadow-lg ${APPOINTMENT_CONFIG.glow}
                rounded-lg sm:rounded-xl backdrop-blur-xl overflow-hidden
                w-full max-w-[94vw] sm:max-w-sm`}
            role="status"
        >
            <div className={`h-0.5 ${APPOINTMENT_CONFIG.bar} toast-progress`} />

            <div className="p-3 sm:p-4">
                <div className="flex items-start gap-2 sm:gap-3">
                    <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-white/10 dark:bg-gray-900/50 mt-0.5 relative shrink-0">
                        <CalendarClock className={`w-4 h-4 sm:w-5 sm:h-5 ${APPOINTMENT_CONFIG.text}`} />
                        <span
                            className={`absolute -top-0.5 -right-0.5 w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${APPOINTMENT_CONFIG.bar} animate-pulse`}
                        />
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                            <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold tracking-wide ${APPOINTMENT_CONFIG.badge}`}
                            >
                                Appointment
                            </span>

                            <span className="text-[10px] sm:text-[11px] text-gray-500 font-mono flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {timeAgo(appointment.created_at)}
                            </span>
                        </div>

                        <p className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-100 leading-snug break-words pr-1">
                            {appointment.title}
                        </p>

                        <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-300 mt-1 leading-snug break-words">
                            Scheduled for {formatAppointmentDate(appointment.scheduled_for)}
                        </p>

                        {appointment.location && (
                            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1 break-words">
                                <MapPin className="w-3 h-3 shrink-0" />
                                {appointment.location}
                            </p>
                        )}

                        {appointment.notes && (
                            <p className="text-[10px] sm:text-[11px] text-gray-500 italic mt-1.5 leading-snug border-t border-gray-200/30 dark:border-white/5 pt-1.5 break-words">
                                {appointment.notes}
                            </p>
                        )}
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-1 shrink-0">
                        <button
                            onClick={handleMarkRead}
                            disabled={markingRead}
                            className="flex items-center justify-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg
                                bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20
                                hover:border-emerald-500/40 text-emerald-600 dark:text-emerald-400
                                text-[10px] sm:text-xs font-medium transition-all duration-200 disabled:opacity-50"
                            title="Mark as read"
                        >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">
                                {markingRead ? 'Saving' : 'Seen'}
                            </span>
                        </button>

                        <button
                            onClick={handleDismiss}
                            className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300
                                hover:bg-gray-200/30 dark:hover:bg-white/5 transition-all duration-200"
                            title="Dismiss"
                        >
                            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/** A single toast notification card. */
function AlertNotificationToast({ alert, onDismiss, onAcknowledge, onActionComplete }) {
    const config = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.warning;
    const SeverityIcon = config.icon;
    const [exiting, setExiting] = useState(false);
    const [acknowledging, setAcknowledging] = useState(false);
    const timerRef = useRef(null);

    const thresholdLine = alert.vital_name
        ? formatThresholdExplanation(
            alert.vital_name,
            alert.vital_value,
            alert.unit ?? '',
            alert.threshold ? null : null
        )
        : null;

    const vitalStatus = alert.vital_name
        ? getVitalStatus(alert.vital_value, null, alert.vital_name)
        : null;
    const advice = vitalStatus?.advice ?? null;

    // Auto-dismiss after 12 seconds
    useEffect(() => {
        timerRef.current = setTimeout(() => {
            setExiting(true);
            setTimeout(() => onDismiss(alert._toastId), 400);
        }, 12000);

        return () => clearTimeout(timerRef.current);
    }, [alert._toastId, onDismiss]);

    const handleDismiss = () => {
        clearTimeout(timerRef.current);
        setExiting(true);
        setTimeout(() => onDismiss(alert._toastId), 400);
    };

    const handleAcknowledge = async () => {
        if (!alert.id) return;
        setAcknowledging(true);

        try {
            await api.acknowledgeAlert(alert.id);
            onActionComplete?.();
            handleDismiss();
        } catch {
            setAcknowledging(false);
        }
    };

    return (
        <div
            className={`toast-notification ${exiting ? 'toast-exit' : 'toast-enter'}
                bg-gradient-to-r ${config.gradient}
                border ${config.border} shadow-lg ${config.glow}
                rounded-lg sm:rounded-xl backdrop-blur-xl overflow-hidden
                w-full max-w-[94vw] sm:max-w-sm`}
            role="alert"
        >
            {/* Progress bar for auto-dismiss countdown */}
            <div className={`h-0.5 ${config.bar} toast-progress`} />

            <div className="p-3 sm:p-4">
                <div className="flex items-start gap-2 sm:gap-3">
                    {/* Severity icon */}
                    <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-white/10 dark:bg-gray-900/50 mt-0.5 relative shrink-0">
                        <SeverityIcon className={`w-4 h-4 sm:w-5 sm:h-5 ${config.text}`} />
                        <span
                            className={`absolute -top-0.5 -right-0.5 w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${config.bar} animate-pulse`}
                        />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        {/* Severity label + time */}
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                            <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold tracking-wide ${config.badge}`}
                            >
                                {friendlySeverityLabel(alert.severity)}
                            </span>

                            <span className="text-[10px] sm:text-[11px] text-gray-500 font-mono flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {timeAgo(alert.timestamp)}
                            </span>
                        </div>

                        {/* Alert message */}
                        <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-200 leading-snug break-words pr-1">
                            {alert.message}
                        </p>

                        {/* Plain-language reading context */}
                        {thresholdLine && (
                            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1 leading-snug break-words">
                                {thresholdLine}
                            </p>
                        )}

                        {/* Helpful advice */}
                        {advice && (
                            <p className="text-[10px] sm:text-[11px] text-gray-500 italic mt-1.5 leading-snug border-t border-gray-200/30 dark:border-white/5 pt-1.5 break-words">
                                💡 {advice}
                            </p>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row items-center gap-1 shrink-0">
                        {alert.id && !alert.acknowledged && (
                            <button
                                onClick={handleAcknowledge}
                                disabled={acknowledging}
                                className="flex items-center justify-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg
                                    bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20
                                    hover:border-emerald-500/40 text-emerald-600 dark:text-emerald-400
                                    text-[10px] sm:text-xs font-medium transition-all duration-200 disabled:opacity-50"
                                title="Acknowledge"
                            >
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">
                                    {acknowledging ? 'Done' : 'Got it'}
                                </span>
                            </button>
                        )}

                        <button
                            onClick={handleDismiss}
                            className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300
                                hover:bg-gray-200/30 dark:hover:bg-white/5 transition-all duration-200"
                            title="Dismiss"
                        >
                            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Toast({ alert, onDismiss, onAcknowledge, onActionComplete }) {
    if (alert.kind === 'appointment') {
        return <AppointmentToast appointment={alert} onDismiss={onDismiss} onActionComplete={onActionComplete} />;
    }

    return <AlertNotificationToast alert={alert} onDismiss={onDismiss} onAcknowledge={onAcknowledge} onActionComplete={onActionComplete} />;
}

/** Container that manages and renders a stack of toast notifications at the top of the screen. */
export default function AlertToast({ toasts, onDismiss, onAcknowledge, onActionComplete }) {
    const seenIdsRef = useRef(new Set());

    // Play sound when new toasts arrive
    useEffect(() => {
        if (!toasts || toasts.length === 0) return;

        const newToasts = toasts.filter((t) => !seenIdsRef.current.has(t._toastId));

        if (newToasts.length > 0) {
            const appointmentToasts = newToasts.filter((t) => t.kind === 'appointment');
            const alertToasts = newToasts.filter((t) => t.kind !== 'appointment');

            if (appointmentToasts.length > 0) {
                playAppointmentSound();
            }

            if (alertToasts.length > 0) {
                const hasCritical = alertToasts.some((t) => t.severity === 'critical');
                playAlertSound(hasCritical ? 'critical' : 'warning');
            }

            newToasts.forEach((t) => seenIdsRef.current.add(t._toastId));
        }
    }, [toasts]);

    if (!toasts || toasts.length === 0) return null;

    return (
        <div
            className="toast-container fixed top-2 left-0 right-0 z-[9999] flex flex-col items-center gap-2 px-2 sm:top-4 sm:px-4"
            id="alert-toast-container"
        >
            {toasts.map((alert) => (
                <Toast
                    key={alert._toastId}
                    alert={alert}
                    onDismiss={onDismiss}
                    onAcknowledge={onAcknowledge}
                    onActionComplete={onActionComplete}
                />
            ))}
        </div>
    );
}
