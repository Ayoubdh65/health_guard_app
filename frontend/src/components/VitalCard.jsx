import React, { useMemo } from 'react';

/**
 * VitalCard – Animated glassmorphism card showing a single vital sign.
 *
 * Props:
 *  - label:  display name (e.g. "Heart Rate")
 *  - value:  current number
 *  - unit:   unit string (e.g. "bpm")
 *  - icon:   Lucide icon component
 *  - color:  tailwind color class (e.g. "text-vital-heart")
 *  - bgColor: ring/glow color (e.g. "bg-vital-heart")
 *  - trend:  optional previous value for trend indicator
 *  - alert:  optional { low, high } thresholds for danger state
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
}) {
    const isAlert = useMemo(() => {
        if (!alert || value == null) return false;
        return value < alert.low || value > alert.high;
    }, [value, alert]);

    const trendDir = useMemo(() => {
        if (trend == null || value == null) return null;
        if (value > trend + 0.5) return 'up';
        if (value < trend - 0.5) return 'down';
        return 'stable';
    }, [value, trend]);

    return (
        <div
            className={`glass-card-hover p-5 relative overflow-hidden group animate-fade-in ${isAlert ? 'border-red-500/50' : ''
                }`}
        >
            {/* Glow background */}
            <div
                className={`absolute -top-8 -right-8 w-24 h-24 ${bgColor} rounded-full opacity-10 blur-2xl group-hover:opacity-20 transition-opacity duration-500`}
            />

            {/* Header */}
            <div className="flex items-center justify-between mb-3 relative z-10">
                <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-xl ${bgColor}/10`}>
                        <Icon className={`w-5 h-5 ${color}`} />
                    </div>
                    <span className="text-sm font-medium text-gray-400">{label}</span>
                </div>
                {isAlert && (
                    <span className="vital-badge bg-red-500/20 text-red-400">
                        <span className="status-dot bg-red-400 animate-pulse" />
                        Alert
                    </span>
                )}
            </div>

            {/* Value */}
            <div className="flex items-baseline gap-2 relative z-10">
                <span className={`text-4xl font-bold tracking-tight ${isAlert ? 'text-red-400' : 'text-white'}`}>
                    {value != null ? value : '—'}
                </span>
                <span className="text-sm text-gray-500 font-medium">{unit}</span>

                {/* Trend arrow */}
                {trendDir && (
                    <span
                        className={`ml-auto text-xs font-mono px-2 py-0.5 rounded-full ${trendDir === 'up'
                                ? 'text-red-400 bg-red-500/10'
                                : trendDir === 'down'
                                    ? 'text-blue-400 bg-blue-500/10'
                                    : 'text-gray-500 bg-gray-800/50'
                            }`}
                    >
                        {trendDir === 'up' ? '↑' : trendDir === 'down' ? '↓' : '→'}
                    </span>
                )}
            </div>

            {/* Pulse animation line */}
            {isAlert && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent animate-pulse" />
            )}
        </div>
    );
}
