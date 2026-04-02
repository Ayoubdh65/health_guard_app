import React, { useMemo } from 'react';
import { getVitalStatus } from '../vitalUtils';

/**
 * VitalCard – Animated glassmorphism card showing a single vital sign.
 *
 * Props:
 *  - label:    display name (e.g. "Heart Rate")
 *  - value:    current number
 *  - unit:     unit string (e.g. "bpm")
 *  - icon:     Lucide icon component
 *  - color:    tailwind color class (e.g. "text-vital-heart")
 *  - bgColor:  ring/glow color (e.g. "bg-vital-heart")
 *  - trend:    optional previous value for trend indicator
 *  - alert:    optional { low, high } thresholds
 *  - vitalKey: optional key for vitalUtils lookup (e.g. "heart_rate")
 */
export default function VitalCard({
    label,
    value,
    unit,
    icon: Icon,
    color = 'text-brand-400',
    bgColor = 'bg-brand-500',
    trend,
    alert,
    vitalKey,
}) {
    const status = useMemo(
        () => getVitalStatus(value, alert, vitalKey),
        [value, alert, vitalKey]
    );

    const isAlert = status.status === 'high' || status.status === 'low';

    const trendDir = useMemo(() => {
        if (trend == null || value == null) return null;
        if (value > trend + 0.5) return 'up';
        if (value < trend - 0.5) return 'down';
        return 'stable';
    }, [value, trend]);

    const barFillClass =
        status.status === 'normal'
            ? 'bg-emerald-400'
            : status.status === 'high'
                ? 'bg-red-400'
                : 'bg-blue-400';

    return (
        <div
            className={`glass-card-hover relative overflow-hidden rounded-2xl p-3 sm:p-5 group animate-fade-in ${isAlert ? `border ${status.borderColor}` : ''
                }`}
        >
            {/* Glow background */}
            <div
                className={`absolute -top-6 -right-6 sm:-top-8 sm:-right-8 w-20 h-20 sm:w-24 sm:h-24 ${bgColor} rounded-full opacity-10 blur-2xl group-hover:opacity-20 transition-opacity duration-500`}
            />

            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-2.5 sm:mb-3 relative z-10">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className={`p-1.5 sm:p-2 rounded-xl ${bgColor}/10 shrink-0`}>
                        <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${color}`} />
                    </div>

                    <span className="flex-1 min-w-0 text-[11px] sm:text-sm font-medium text-gray-500 dark:text-gray-400 leading-tight whitespace-normal break-words">
                        {label}
                    </span>
                </div>

                {value != null && (
                    <span
                        className={`vital-badge ${status.bgColor} ${status.textColor} text-[9px] sm:text-[10px] font-semibold shrink-0`}
                    >
                        {status.status !== 'unknown' && (
                            <span
                                className={`status-dot ${status.status === 'normal'
                                        ? 'bg-emerald-400'
                                        : status.status === 'high'
                                            ? 'bg-red-400 animate-pulse'
                                            : 'bg-blue-400 animate-pulse'
                                    }`}
                            />
                        )}
                        {status.label}
                    </span>
                )}
            </div>

            {/* Value */}
            <div className="flex items-end gap-1.5 sm:gap-2 relative z-10 min-w-0">
                <span
                    className={`text-2xl sm:text-4xl font-bold tracking-tight leading-none ${isAlert ? status.textColor : 'text-gray-900 dark:text-white'
                        }`}
                >
                    {value != null ? value : '—'}
                </span>

                <span className="text-xs sm:text-sm text-gray-400 dark:text-gray-500 font-medium mb-0.5">
                    {unit}
                </span>

                {trendDir && (
                    <span
                        className={`ml-auto text-[10px] sm:text-xs font-mono px-1.5 sm:px-2 py-0.5 rounded-full shrink-0 ${trendDir === 'up'
                                ? 'text-red-400 bg-red-500/10'
                                : trendDir === 'down'
                                    ? 'text-blue-400 bg-blue-500/10'
                                    : 'text-gray-500 bg-gray-200/50 dark:bg-gray-800/50'
                            }`}
                    >
                        {trendDir === 'up' ? '↑' : trendDir === 'down' ? '↓' : '→'}
                    </span>
                )}
            </div>

            {/* Normal range subtitle */}
            {status.normalRangeText && (
                <p className="text-[9px] sm:text-[10px] text-gray-400 dark:text-gray-600 mt-1 relative z-10 leading-snug">
                    {status.normalRangeText}
                </p>
            )}

            {/* Range bar */}
            {value != null && alert && (
                <div className="mt-2.5 sm:mt-3 relative z-10">
                    <div className="relative h-1.5 w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                        {/* Green safe zone */}
                        <div
                            className="absolute h-1.5 bg-emerald-500/20 rounded-full"
                            style={{
                                left: `${getZoneLeft(alert) * 100}%`,
                                width: `${getZoneWidth(alert) * 100}%`,
                            }}
                        />

                        {/* Marker dot */}
                        <div
                            className={`absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 sm:w-2 sm:h-2 rounded-full shadow-md ${barFillClass}`}
                            style={{
                                left: `calc(${status.rangePct * 100}% - 5px)`,
                            }}
                        />
                    </div>

                    <div className="flex justify-between text-[8px] sm:text-[9px] text-gray-400 dark:text-gray-700 mt-1">
                        <span>Low</span>
                        <span>High</span>
                    </div>
                </div>
            )}

            {/* Advice for out-of-range */}
            {isAlert && status.advice && (
                <p className="text-[10px] text-gray-500 italic mt-2 leading-snug relative z-10 break-words">
                    {status.advice}
                </p>
            )}

            {/* Pulse animation line */}
            {isAlert && (
                <div
                    className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent ${status.status === 'high' ? 'via-red-500' : 'via-blue-500'
                        } to-transparent animate-pulse`}
                />
            )}
        </div>
    );
}

// Helpers to position the "safe zone" overlay on the range bar
function getZoneLeft(alert) {
    const span = alert.high - alert.low;
    const extended = span * 0.4;
    const visualMin = alert.low - extended;
    const visualMax = alert.high + extended;
    const totalSpan = visualMax - visualMin;
    return (alert.low - visualMin) / totalSpan;
}

function getZoneWidth(alert) {
    const span = alert.high - alert.low;
    const extended = span * 0.4;
    const visualMin = alert.low - extended;
    const visualMax = alert.high + extended;
    const totalSpan = visualMax - visualMin;
    return span / totalSpan;
}