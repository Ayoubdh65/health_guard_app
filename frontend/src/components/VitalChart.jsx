import React, { useMemo } from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';
import { useTheme } from './ThemeProvider';

const VITAL_COLORS = {
    heart_rate: { stroke: '#ef4444', fill: '#ef444420' },
    spo2: { stroke: '#3b82f6', fill: '#3b82f620' },
    temperature: { stroke: '#f59e0b', fill: '#f59e0b20' },
    blood_pressure_sys: { stroke: '#8b5cf6', fill: '#8b5cf620' },
    blood_pressure_dia: { stroke: '#a78bfa', fill: '#a78bfa15' },
    respiratory_rate: { stroke: '#10b981', fill: '#10b98120' },
};

const VITAL_LABELS = {
    heart_rate: 'Heart Rate',
    spo2: 'SpO₂',
    temperature: 'Temp',
    blood_pressure_sys: 'BP Sys',
    blood_pressure_dia: 'BP Dia',
    respiratory_rate: 'Resp Rate',
};

function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="glass-card p-3 text-xs space-y-1">
            <p className="text-gray-500 dark:text-gray-400 font-mono">{formatTime(label)}</p>
            {payload.map((entry) => (
                <div key={entry.dataKey} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.stroke }} />
                    <span className="text-gray-600 dark:text-gray-300">{VITAL_LABELS[entry.dataKey] || entry.dataKey}:</span>
                    <span className="font-bold text-gray-900 dark:text-white">{entry.value}</span>
                </div>
            ))}
        </div>
    );
};

/**
 * VitalChart – Real-time area chart for multiple vital signs.
 *
 * Props:
 *  - data: array of vital reading objects
 *  - visibleVitals: array of vital keys to display
 *  - height: chart height in pixels (default 350)
 */
export default function VitalChart({
    data = [],
    visibleVitals = ['heart_rate', 'spo2'],
    height = 350,
}) {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const gridColor = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
    const axisColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)';
    const tickColor = isDark ? '#6b7280' : '#9ca3af';

    const chartData = useMemo(() => {
        return data.map((d) => ({
            ...d,
            time: d.timestamp,
        }));
    }, [data]);

    return (
        <div className="glass-card p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Real-Time Vitals
                    <span className="ml-2 text-xs text-gray-500 font-normal">Live stream</span>
                </h3>
                <div className="flex items-center gap-1.5">
                    <span className="status-dot-active" />
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Live</span>
                </div>
            </div>

            {chartData.length === 0 ? (
                <div className="flex items-center justify-center text-gray-400 dark:text-gray-600" style={{ height }}>
                    <div className="text-center">
                        <div className="text-4xl mb-2">📡</div>
                        <p className="text-sm">Waiting for sensor data…</p>
                    </div>
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={height}>
                    <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                        <defs>
                            {visibleVitals.map((key) => (
                                <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={VITAL_COLORS[key]?.stroke || '#888'} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={VITAL_COLORS[key]?.stroke || '#888'} stopOpacity={0} />
                                </linearGradient>
                            ))}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                        <XAxis
                            dataKey="time"
                            tickFormatter={formatTime}
                            stroke={axisColor}
                            tick={{ fill: tickColor, fontSize: 11 }}
                        />
                        <YAxis
                            stroke={axisColor}
                            tick={{ fill: tickColor, fontSize: 11 }}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                            verticalAlign="top"
                            height={36}
                            formatter={(value) => (
                                <span className="text-xs text-gray-500 dark:text-gray-400">{VITAL_LABELS[value] || value}</span>
                            )}
                        />
                        {visibleVitals.map((key) => (
                            <Area
                                key={key}
                                type="monotone"
                                dataKey={key}
                                stroke={VITAL_COLORS[key]?.stroke || '#888'}
                                fill={`url(#grad-${key})`}
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 4, strokeWidth: 0 }}
                                animationDuration={300}
                            />
                        ))}
                    </AreaChart>
                </ResponsiveContainer>
            )}
        </div>
    );
}
