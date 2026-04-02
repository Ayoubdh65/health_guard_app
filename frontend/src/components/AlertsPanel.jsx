import React, { useState } from 'react';
import { Bell, CheckCircle, Clock, Shield, ShieldAlert, AlertTriangle, Filter } from 'lucide-react';
import { api } from '../api';
import { useAlerts, useAlertStats } from '../hooks/useHealthData';
import { formatThresholdExplanation, friendlySeverityLabel, getVitalStatus } from '../vitalUtils';

const SEVERITY_CONFIG = {
    critical: {
        bg: 'bg-red-500/10',
        border: 'border-red-500/30',
        text: 'text-red-500 dark:text-red-400',
        badge: 'bg-red-500/20 text-red-500 dark:text-red-400',
        icon: ShieldAlert,
        dot: 'bg-red-400',
    },
    warning: {
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        text: 'text-amber-500 dark:text-amber-400',
        badge: 'bg-amber-500/20 text-amber-500 dark:text-amber-400',
        icon: AlertTriangle,
        dot: 'bg-amber-400',
    },
};

function timeAgo(timestamp) {
    const now = new Date();
    const then = new Date(timestamp);
    const diff = Math.floor((now - then) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

function AlertCard({ alert, onAcknowledge, acknowledging }) {
    const config = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.warning;
    const SeverityIcon = config.icon;

    const thresholdLine = alert.vital_name
        ? formatThresholdExplanation(
            alert.vital_name,
            alert.vital_value,
            alert.unit ?? '',
            null
        )
        : null;

    const vitalStatus = alert.vital_name
        ? getVitalStatus(alert.vital_value, null, alert.vital_name)
        : null;
    const advice = vitalStatus?.advice ?? null;

    return (
        <div
            className={`glass-card rounded-2xl p-3 sm:p-4 ${config.border} border animate-fade-in overflow-hidden`}
        >
            <div className="flex items-start gap-2.5 sm:gap-3">
                <div className={`p-1.5 sm:p-2 rounded-xl ${config.bg} mt-0.5 shrink-0`}>
                    <SeverityIcon className={`w-4 h-4 sm:w-5 sm:h-5 ${config.text}`} />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1.5">
                        <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${config.badge} text-[9px] sm:text-[10px] font-semibold`}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                            {friendlySeverityLabel(alert.severity)}
                        </span>

                        <span className="text-[10px] sm:text-xs text-gray-500 font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {timeAgo(alert.timestamp)}
                        </span>
                    </div>

                    <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-200 leading-snug break-words">
                        {alert.message}
                    </p>

                    {thresholdLine && (
                        <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 leading-snug mt-1 break-words">
                            {thresholdLine}
                        </p>
                    )}

                    {advice && (
                        <p className="text-[10px] sm:text-[11px] text-gray-500 italic leading-snug border-t border-gray-200/30 dark:border-white/5 pt-1.5 mt-1.5 break-words">
                            💡 {advice}
                        </p>
                    )}
                </div>

                {!alert.acknowledged ? (
                    <button
                        onClick={() => onAcknowledge(alert.id)}
                        disabled={acknowledging === alert.id}
                        className="flex items-center justify-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg shrink-0
                            bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20
                            hover:border-emerald-500/40 text-emerald-600 dark:text-emerald-400
                            text-[10px] sm:text-xs font-medium transition-all duration-200 disabled:opacity-50 whitespace-nowrap self-start"
                    >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">
                            {acknowledging === alert.id ? 'Done' : 'Got it'}
                        </span>
                    </button>
                ) : (
                    <div className="flex items-center gap-1 text-[10px] sm:text-xs text-emerald-500/70 shrink-0 self-start">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Noted</span>
                    </div>
                )}
            </div>
        </div>
    );
}

function StatBox({ value, label, valueClass = '', borderClass = '' }) {
    return (
        <div className={`glass-card rounded-2xl p-3 sm:p-4 text-center ${borderClass}`}>
            <div className={`text-lg sm:text-2xl font-bold ${valueClass}`}>{value}</div>
            <div className="text-[10px] sm:text-xs text-gray-500 mt-1 leading-snug">{label}</div>
        </div>
    );
}

export default function AlertsPanel() {
    const { alerts, loading, refresh } = useAlerts(8000);
    const { stats } = useAlertStats(8000);
    const [filter, setFilter] = useState('all');
    const [acknowledging, setAcknowledging] = useState(null);
    const [allAlerts, setAllAlerts] = useState([]);
    const [allLoading, setAllLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const loadAllAlerts = async (page = 1) => {
        setAllLoading(true);
        try {
            const sev = filter === 'critical' || filter === 'warning' ? filter : '';
            const ack = filter === 'acknowledged' ? 'true' : '';
            const res = await api.getAlerts(page, sev, ack);
            setAllAlerts(res.items || []);
            setTotalPages(res.pages || 1);
            setCurrentPage(res.page || 1);
        } catch {
            /* ignore */
        }
        setAllLoading(false);
    };

    React.useEffect(() => {
        loadAllAlerts(1);
    }, [filter]);

    const handleAcknowledge = async (id) => {
        setAcknowledging(id);
        try {
            await api.acknowledgeAlert(id);
            await refresh();
            await loadAllAlerts(currentPage);
        } catch {
            /* ignore */
        }
        setAcknowledging(null);
    };

    const filters = [
        { key: 'all', label: 'All' },
        { key: 'critical', label: '⚡ Urgent' },
        { key: 'warning', label: '⚠️ Attention' },
        { key: 'acknowledged', label: '✅ Noted' },
    ];

    return (
        <div className="space-y-3 sm:space-y-6 animate-fade-in">
            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                <StatBox
                    value={stats.total}
                    label="Total Alerts"
                    valueClass="text-gray-900 dark:text-white"
                />
                <StatBox
                    value={stats.critical}
                    label="⚡ Urgent"
                    valueClass="text-red-500 dark:text-red-400"
                    borderClass="border border-red-500/20"
                />
                <StatBox
                    value={stats.warning}
                    label="⚠️ Needs Attention"
                    valueClass="text-amber-500 dark:text-amber-400"
                    borderClass="border border-amber-500/20"
                />
                <StatBox
                    value={stats.unacknowledged}
                    label="Not Yet Noted"
                    valueClass="text-brand-500 dark:text-brand-400"
                    borderClass="border border-brand-500/20"
                />
            </div>

            {/* Active alerts banner */}
            {alerts.length > 0 && filter === 'all' && (
                <div className="glass-card rounded-2xl p-3 sm:p-4 border border-red-500/20">
                    <h3 className="text-xs sm:text-sm font-semibold text-red-500 dark:text-red-400 flex items-center gap-2 mb-3 leading-snug">
                        <Bell className="w-4 h-4 shrink-0" />
                        <span>
                            Active Alerts ({alerts.length}) — Needs your attention
                        </span>
                    </h3>

                    <div className="space-y-2">
                        {alerts.slice(0, 5).map((alert) => (
                            <AlertCard
                                key={alert.id}
                                alert={alert}
                                onAcknowledge={handleAcknowledge}
                                acknowledging={acknowledging}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Filter bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                <Filter className="w-4 h-4 text-gray-500 shrink-0" />
                {filters.map(({ key, label }) => (
                    <button
                        key={key}
                        onClick={() => setFilter(key)}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-medium transition-all duration-200 whitespace-nowrap ${filter === key
                                ? 'bg-brand-500/15 dark:bg-brand-600/20 text-brand-600 dark:text-brand-300 border border-brand-400/30 dark:border-brand-500/30 shadow-sm'
                                : 'bg-gray-100/70 dark:bg-white/[0.03] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 border border-gray-200/60 dark:border-white/[0.05]'
                            }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Alert list */}
            <div className="space-y-2.5">
                {allLoading ? (
                    <div className="space-y-2">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="glass-card rounded-2xl p-3 sm:p-4 animate-pulse">
                                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-3/4 mb-2" />
                                <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/2" />
                            </div>
                        ))}
                    </div>
                ) : allAlerts.length === 0 ? (
                    <div className="glass-card rounded-2xl p-8 sm:p-12 text-center">
                        <Shield className="w-10 h-10 sm:w-12 sm:h-12 text-emerald-500/30 mx-auto mb-3" />
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                            All clear! 🎉
                        </p>
                        <p className="text-[11px] sm:text-xs text-gray-400 dark:text-gray-600 mt-1">
                            All vital signs are within safe ranges
                        </p>
                    </div>
                ) : (
                    allAlerts.map((alert) => (
                        <AlertCard
                            key={alert.id}
                            alert={alert}
                            onAcknowledge={handleAcknowledge}
                            acknowledging={acknowledging}
                        />
                    ))
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
                    <button
                        onClick={() => loadAllAlerts(currentPage - 1)}
                        disabled={currentPage <= 1}
                        className="px-3 py-1.5 rounded-lg text-[11px] sm:text-xs bg-gray-100/70 dark:bg-white/[0.03] text-gray-500 dark:text-gray-400
                            border border-gray-200/60 dark:border-white/[0.05] hover:border-gray-300 dark:hover:border-white/[0.08]
                            disabled:opacity-30 transition-all"
                    >
                        Previous
                    </button>

                    <span className="text-[11px] sm:text-xs text-gray-500">
                        Page {currentPage} of {totalPages}
                    </span>

                    <button
                        onClick={() => loadAllAlerts(currentPage + 1)}
                        disabled={currentPage >= totalPages}
                        className="px-3 py-1.5 rounded-lg text-[11px] sm:text-xs bg-gray-100/70 dark:bg-white/[0.03] text-gray-500 dark:text-gray-400
                            border border-gray-200/60 dark:border-white/[0.05] hover:border-gray-300 dark:hover:border-white/[0.08]
                            disabled:opacity-30 transition-all"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}