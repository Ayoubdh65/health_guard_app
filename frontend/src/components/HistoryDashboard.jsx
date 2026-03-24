import React, { useState, useMemo } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend,
} from 'recharts';
import { Clock, TrendingUp, BarChart3 } from 'lucide-react';
import { useVitalHistory, useVitalStats } from '../hooks/useHealthData';
import { useTheme } from './ThemeProvider';

const VITAL_COLORS = {
    heart_rate: { stroke: '#ef4444', fill: '#ef444420', label: 'Heart Rate', unit: 'bpm' },
    spo2: { stroke: '#3b82f6', fill: '#3b82f620', label: 'SpO₂', unit: '%' },
    temperature: { stroke: '#f59e0b', fill: '#f59e0b20', label: 'Temp', unit: '°C' },
    blood_pressure_sys: { stroke: '#8b5cf6', fill: '#8b5cf620', label: 'BP Sys', unit: 'mmHg' },
    blood_pressure_dia: { stroke: '#a78bfa', fill: '#a78bfa15', label: 'BP Dia', unit: 'mmHg' },
    respiratory_rate: { stroke: '#10b981', fill: '#10b98120', label: 'Resp Rate', unit: 'br/min' },
};

const PERIODS = [
    { key: '1h', label: '1 Hour' },
    { key: '6h', label: '6 Hours' },
    { key: '24h', label: '24 Hours' },
    { key: '7d', label: '7 Days' },
    { key: '30d', label: '30 Days' },
];

function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
        ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="glass-card p-3 text-xs space-y-1">
            <p className="text-gray-500 dark:text-gray-400 font-mono">{formatDate(label)}</p>
            {payload.map((entry) => (
                <div key={entry.dataKey} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.stroke }} />
                    <span className="text-gray-600 dark:text-gray-300">
                        {VITAL_COLORS[entry.dataKey]?.label || entry.dataKey}:
                    </span>
                    <span className="font-bold text-gray-900 dark:text-white">
                        {entry.value} {VITAL_COLORS[entry.dataKey]?.unit || ''}
                    </span>
                </div>
            ))}
        </div>
    );
};

function StatCard({ label, value, unit, color }) {
    return (
        <div className="glass-card p-3 text-center">
            <div className="text-lg font-bold" style={{ color }}>
                {value ?? '—'}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
                {label} {unit && <span className="text-gray-400 dark:text-gray-600">({unit})</span>}
            </div>
        </div>
    );
}

export default function HistoryDashboard() {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const gridColor = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
    const axisColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)';
    const tickColor = isDark ? '#6b7280' : '#9ca3af';

    const [period, setPeriod] = useState('24h');
    const [visibleVitals, setVisibleVitals] = useState(['heart_rate', 'spo2']);

    const periodHours = { '1h': 1, '6h': 6, '24h': 24, '7d': 168, '30d': 720 };
    const { data, loading } = useVitalHistory(period);
    const { stats, loading: statsLoading } = useVitalStats(periodHours[period]);

    const chartData = useMemo(() => {
        if (!data?.points) return [];
        return data.points.map((p) => ({
            ...p,
            time: p.timestamp,
        }));
    }, [data]);

    const toggleVital = (key) => {
        setVisibleVitals((prev) =>
            prev.includes(key)
                ? prev.filter((v) => v !== key)
                : [...prev, key]
        );
    };

    const tickFormatter = period === '7d' || period === '30d' ? formatDate : formatTime;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Period selector */}
            <div className="glass-card p-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-brand-500/10">
                            <TrendingUp className="w-5 h-5 text-brand-500 dark:text-brand-400" />
                        </div>
                        Vital Trends
                    </h3>
                    <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-gray-500" />
                        {PERIODS.map(({ key, label }) => (
                            <button
                                key={key}
                                onClick={() => setPeriod(key)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${period === key
                                    ? 'bg-brand-500/15 dark:bg-brand-600/20 text-brand-600 dark:text-brand-300 border border-brand-400/30 dark:border-brand-500/30'
                                    : 'bg-gray-100/60 dark:bg-white/[0.02] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 border border-gray-200/50 dark:border-white/[0.04]'
                                    }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Vital toggle buttons */}
            <div className="flex items-center gap-2 flex-wrap">
                {Object.entries(VITAL_COLORS).map(([key, { stroke, label }]) => (
                    <button
                        key={key}
                        onClick={() => toggleVital(key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5 ${visibleVitals.includes(key)
                            ? 'border border-opacity-40'
                            : 'bg-gray-100/60 dark:bg-white/[0.02] text-gray-500 dark:text-gray-600 border border-gray-200/50 dark:border-white/[0.04]'
                            }`}
                        style={
                            visibleVitals.includes(key)
                                ? { color: stroke, borderColor: stroke, backgroundColor: `${stroke}10` }
                                : {}
                        }
                    >
                        <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: visibleVitals.includes(key) ? stroke : (isDark ? '#374151' : '#d1d5db') }}
                        />
                        {label}
                    </button>
                ))}
            </div>

            {/* Chart */}
            <div className="glass-card p-6">
                {loading ? (
                    <div className="flex items-center justify-center" style={{ height: 400 }}>
                        <div className="text-center">
                            <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full mx-auto mb-3" />
                            <p className="text-sm text-gray-500">Loading history…</p>
                        </div>
                    </div>
                ) : chartData.length === 0 ? (
                    <div className="flex items-center justify-center text-gray-400 dark:text-gray-600" style={{ height: 400 }}>
                        <div className="text-center">
                            <BarChart3 className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
                            <p className="text-sm">No data for this period</p>
                            <p className="text-xs text-gray-400 dark:text-gray-700 mt-1">Start collecting readings to see trends</p>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between mb-3">
                            <div className="text-xs text-gray-500">
                                {data?.total_readings?.toLocaleString()} readings · {data?.granularity}
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={400}>
                            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                                <defs>
                                    {visibleVitals.map((key) => (
                                        <linearGradient key={key} id={`hist-grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={VITAL_COLORS[key]?.stroke || '#888'} stopOpacity={0.3} />
                                            <stop offset="95%" stopColor={VITAL_COLORS[key]?.stroke || '#888'} stopOpacity={0} />
                                        </linearGradient>
                                    ))}
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                                <XAxis
                                    dataKey="time"
                                    tickFormatter={tickFormatter}
                                    stroke={axisColor}
                                    tick={{ fill: tickColor, fontSize: 11 }}
                                    interval="preserveStartEnd"
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
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                            {VITAL_COLORS[value]?.label || value}
                                        </span>
                                    )}
                                />
                                {visibleVitals.map((key) => (
                                    <Area
                                        key={key}
                                        type="monotone"
                                        dataKey={key}
                                        stroke={VITAL_COLORS[key]?.stroke || '#888'}
                                        fill={`url(#hist-grad-${key})`}
                                        strokeWidth={2}
                                        dot={false}
                                        activeDot={{ r: 4, strokeWidth: 0 }}
                                        animationDuration={500}
                                        connectNulls
                                    />
                                ))}
                            </AreaChart>
                        </ResponsiveContainer>
                    </>
                )}
            </div>

            {/* Stats cards */}
            {stats && !statsLoading && (
                <div className="glass-card p-4">
                    <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" />
                        Period Statistics
                    </h4>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                        <StatCard label="Avg HR" value={stats.heart_rate_avg} unit="bpm" color="#ef4444" />
                        <StatCard label="Avg SpO₂" value={stats.spo2_avg} unit="%" color="#3b82f6" />
                        <StatCard label="Avg Temp" value={stats.temperature_avg} unit="°C" color="#f59e0b" />
                        <StatCard label="Avg BP Sys" value={stats.blood_pressure_sys_avg} unit="mmHg" color="#8b5cf6" />
                        <StatCard label="Avg BP Dia" value={stats.blood_pressure_dia_avg} unit="mmHg" color="#a78bfa" />
                        <StatCard label="Avg RR" value={stats.respiratory_rate_avg} unit="br/min" color="#10b981" />
                    </div>
                </div>
            )}
        </div>
    );
}
