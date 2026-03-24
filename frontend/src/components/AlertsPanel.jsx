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

    // Plain-language threshold explanation
    const thresholdLine = alert.vital_name
        ? formatThresholdExplanation(
            alert.vital_name,
            alert.vital_value,
            alert.unit ?? '',
            null
        )
        : null;

    // Advice from vitalUtils
    const vitalStatus = alert.vital_name
        ? getVitalStatus(alert.vital_value, null, alert.vital_name)
        : null;
    const advice = vitalStatus?.advice ?? null;

    return (
        <div className={`glass-card p-4 ${config.border} border animate-fade-in`}>
            <div className="flex items-start gap-3">
                <div className={`p-2 rounded-xl ${config.bg} mt-0.5 shrink-0`}>
                    <SeverityIcon className={`w-5 h-5 ${config.text}`} />
                </div>

                <div className="flex-1 min-w-0">
                    {/* Header row: friendly severity + time */}
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`vital-badge ${config.badge} text-[10px] font-semibold`}>
                            <span className={`status-dot ${config.dot}`} />
                            {friendlySeverityLabel(alert.severity)}
                        </span>
                        <span className="text-xs text-gray-500 font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {timeAgo(alert.timestamp)}
                        </span>
                    </div>

                    {/* Alert message */}
                    <p className="text-sm text-gray-700 dark:text-gray-200 mb-1">{alert.message}</p>

                    {/* Plain-language reading context */}
                    {thresholdLine && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug mb-1">
                            {thresholdLine}
                        </p>
                    )}

                    {/* Short advice */}
                    {advice && (
                        <p className="text-[11px] text-gray-500 italic leading-snug border-t border-gray-200/30 dark:border-white/5 pt-1.5 mt-1.5">
                            💡 {advice}
                        </p>
                    )}
                </div>

                {/* Acknowledge / already-acked indicator */}
                {!alert.acknowledged ? (
                    <button
                        onClick={() => onAcknowledge(alert.id)}
                        disabled={acknowledging === alert.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg shrink-0
                            bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20
                            hover:border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-xs font-medium
                            transition-all duration-200 disabled:opacity-50 whitespace-nowrap"
                    >
                        <CheckCircle className="w-3.5 h-3.5" />
                        {acknowledging === alert.id ? 'Done' : 'Got it'}
                    </button>
                ) : (
                    <div className="flex items-center gap-1 text-xs text-emerald-500/60 shrink-0">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Noted</span>
                    </div>
                )}
            </div>
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
        } catch { /* ignore */ }
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
        } catch { /* ignore */ }
        setAcknowledging(null);
    };

    const filters = [
        { key: 'all', label: 'All' },
        { key: 'critical', label: '⚡ Urgent' },
        { key: 'warning', label: '⚠️ Attention' },
        { key: 'acknowledged', label: '✅ Noted' },
    ];

    return (
        <div className="space-y-6 animate-fade-in">

            {/* ── Summary stats ──────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="glass-card p-4 text-center">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
                    <div className="text-xs text-gray-500 mt-1">Total Alerts</div>
                </div>
                <div className="glass-card p-4 text-center border border-red-500/20">
                    <div className="text-2xl font-bold text-red-500 dark:text-red-400">{stats.critical}</div>
                    <div className="text-xs text-gray-500 mt-1">⚡ Urgent</div>
                </div>
                <div className="glass-card p-4 text-center border border-amber-500/20">
                    <div className="text-2xl font-bold text-amber-500 dark:text-amber-400">{stats.warning}</div>
                    <div className="text-xs text-gray-500 mt-1">⚠️ Needs Attention</div>
                </div>
                <div className="glass-card p-4 text-center border border-brand-500/20">
                    <div className="text-2xl font-bold text-brand-500 dark:text-brand-400">{stats.unacknowledged}</div>
                    <div className="text-xs text-gray-500 mt-1">Not Yet Noted</div>
                </div>
            </div>

            {/* ── Active alerts banner ───────────────────────────────────── */}
            {alerts.length > 0 && filter === 'all' && (
                <div className="glass-card p-4 border border-red-500/20">
                    <h3 className="text-sm font-semibold text-red-500 dark:text-red-400 flex items-center gap-2 mb-3">
                        <Bell className="w-4 h-4" />
                        Active Alerts ({alerts.length}) — Needs your attention
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

            {/* ── Filter bar ─────────────────────────────────────────────── */}
            <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-4 h-4 text-gray-500" />
                {filters.map(({ key, label }) => (
                    <button
                        key={key}
                        onClick={() => setFilter(key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${filter === key
                            ? 'bg-brand-500/15 dark:bg-brand-600/20 text-brand-600 dark:text-brand-300 border border-brand-400/30 dark:border-brand-500/30'
                            : 'bg-gray-100/60 dark:bg-white/[0.02] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 border border-gray-200/50 dark:border-white/[0.04]'
                            }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* ── Alert list ─────────────────────────────────────────────── */}
            <div className="space-y-2">
                {allLoading ? (
                    <div className="space-y-2">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="glass-card p-4 animate-pulse">
                                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-3/4 mb-2" />
                                <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/2" />
                            </div>
                        ))}
                    </div>
                ) : allAlerts.length === 0 ? (
                    <div className="glass-card p-12 text-center">
                        <Shield className="w-12 h-12 text-emerald-500/30 mx-auto mb-3" />
                        <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">All clear! 🎉</p>
                        <p className="text-gray-400 dark:text-gray-600 text-xs mt-1">All vital signs are within safe ranges</p>
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

            {/* ── Pagination ─────────────────────────────────────────────── */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    <button
                        onClick={() => loadAllAlerts(currentPage - 1)}
                        disabled={currentPage <= 1}
                        className="px-3 py-1.5 rounded-lg text-xs bg-gray-100/60 dark:bg-white/[0.02] text-gray-500 dark:text-gray-400
                            border border-gray-200/50 dark:border-white/[0.04] hover:border-gray-300 dark:hover:border-white/[0.08] disabled:opacity-30
                            transition-all"
                    >
                        Previous
                    </button>
                    <span className="text-xs text-gray-500">
                        Page {currentPage} of {totalPages}
                    </span>
                    <button
                        onClick={() => loadAllAlerts(currentPage + 1)}
                        disabled={currentPage >= totalPages}
                        className="px-3 py-1.5 rounded-lg text-xs bg-gray-100/60 dark:bg-white/[0.02] text-gray-500 dark:text-gray-400
                            border border-gray-200/50 dark:border-white/[0.04] hover:border-gray-300 dark:hover:border-white/[0.08] disabled:opacity-30
                            transition-all"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}
