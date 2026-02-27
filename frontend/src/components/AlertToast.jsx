import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, ShieldAlert, CheckCircle, X, Clock, Bell } from 'lucide-react';
import { api } from '../api';

const SEVERITY_CONFIG = {
    critical: {
        icon: ShieldAlert,
        gradient: 'from-red-500/20 to-red-900/10',
        border: 'border-red-500/40',
        glow: 'shadow-red-500/20',
        text: 'text-red-400',
        badge: 'bg-red-500/20 text-red-400',
        bar: 'bg-red-500',
    },
    warning: {
        icon: AlertTriangle,
        gradient: 'from-amber-500/20 to-amber-900/10',
        border: 'border-amber-500/40',
        glow: 'shadow-amber-500/20',
        text: 'text-amber-400',
        badge: 'bg-amber-500/20 text-amber-400',
        bar: 'bg-amber-500',
    },
};

// ── Alert sound using Web Audio API ────────────────────────────────────────

function playAlertSound(severity = 'warning') {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const isCritical = severity === 'critical';

        // Play a sequence of short tones
        const frequencies = isCritical
            ? [880, 1100, 880]     // urgent 3-tone
            : [660, 880];          // gentle 2-tone ascending

        frequencies.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = isCritical ? 'square' : 'sine';
            osc.frequency.value = freq;

            const start = ctx.currentTime + i * (isCritical ? 0.12 : 0.15);
            const duration = isCritical ? 0.1 : 0.13;

            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(isCritical ? 0.15 : 0.1, start + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

            osc.start(start);
            osc.stop(start + duration);
        });

        // Close context after sounds finish
        setTimeout(() => ctx.close(), 1000);
    } catch {
        // Audio not supported or blocked — fail silently
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

/** A single toast notification card. */
function Toast({ alert, onDismiss, onAcknowledge }) {
    const config = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.warning;
    const SeverityIcon = config.icon;
    const [exiting, setExiting] = useState(false);
    const [acknowledging, setAcknowledging] = useState(false);
    const timerRef = useRef(null);

    // Auto-dismiss after 10 seconds
    useEffect(() => {
        timerRef.current = setTimeout(() => {
            setExiting(true);
            setTimeout(() => onDismiss(alert._toastId), 400);
        }, 10000);
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
                rounded-xl backdrop-blur-xl overflow-hidden
                max-w-md w-full`}
            role="alert"
        >
            {/* Progress bar for auto-dismiss countdown */}
            <div className={`h-0.5 ${config.bar} toast-progress`} />

            <div className="p-4">
                <div className="flex items-start gap-3">
                    {/* Severity icon with pulse */}
                    <div className={`p-2 rounded-xl bg-gray-900/50 mt-0.5 relative`}>
                        <SeverityIcon className={`w-5 h-5 ${config.text}`} />
                        <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${config.bar} animate-pulse`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${config.badge}`}>
                                {alert.severity}
                            </span>
                            <span className="text-[11px] text-gray-500 font-mono flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {timeAgo(alert.timestamp)}
                            </span>
                        </div>
                        <p className="text-sm text-gray-200 leading-snug">{alert.message}</p>
                        {alert.vital_name && (
                            <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                                <span>
                                    {alert.vital_name}: <strong className="text-gray-300">{alert.vital_value}</strong>
                                </span>
                                {alert.threshold && <span>Threshold: {alert.threshold}</span>}
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                        {alert.id && !alert.acknowledged && (
                            <button
                                onClick={handleAcknowledge}
                                disabled={acknowledging}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg
                                    bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20
                                    hover:border-emerald-500/40 text-emerald-400 text-xs font-medium
                                    transition-all duration-200 disabled:opacity-50"
                                title="Acknowledge"
                            >
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">{acknowledging ? 'Done' : 'Ack'}</span>
                            </button>
                        )}
                        <button
                            onClick={handleDismiss}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300
                                hover:bg-white/5 transition-all duration-200"
                            title="Dismiss"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/** Container that manages and renders a stack of toast notifications at the top of the screen. */
export default function AlertToast({ toasts, onDismiss, onAcknowledge }) {
    const seenIdsRef = useRef(new Set());

    // Play sound when new toasts arrive
    useEffect(() => {
        if (!toasts || toasts.length === 0) return;

        const newToasts = toasts.filter((t) => !seenIdsRef.current.has(t._toastId));
        if (newToasts.length > 0) {
            // Use the highest severity from the batch
            const hasCritical = newToasts.some((t) => t.severity === 'critical');
            playAlertSound(hasCritical ? 'critical' : 'warning');
            newToasts.forEach((t) => seenIdsRef.current.add(t._toastId));
        }
    }, [toasts]);

    if (!toasts || toasts.length === 0) return null;

    return (
        <div className="toast-container" id="alert-toast-container">
            {toasts.map((alert) => (
                <Toast
                    key={alert._toastId}
                    alert={alert}
                    onDismiss={onDismiss}
                    onAcknowledge={onAcknowledge}
                />
            ))}
        </div>
    );
}
