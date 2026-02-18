import React, { useState } from 'react';
import { Server, Database, RefreshCw, Wifi, Clock, HardDrive } from 'lucide-react';
import { api } from '../api';

/**
 * SystemStatus – Device health card with manual sync trigger.
 *
 * Props:
 *  - status: system status object from API
 *  - loading: boolean
 */
export default function SystemStatus({ status, loading }) {
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState(null);

    const handleSync = async () => {
        setSyncing(true);
        setSyncResult(null);
        try {
            const res = await api.triggerSync();
            setSyncResult(res);
        } catch (err) {
            setSyncResult({ status: 'failed', error: err.message });
        } finally {
            setSyncing(false);
        }
    };

    if (loading) {
        return (
            <div className="glass-card p-6 animate-pulse">
                <div className="h-4 bg-gray-800 rounded w-32 mb-4" />
                <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-3 bg-gray-800 rounded w-full" />
                    ))}
                </div>
            </div>
        );
    }

    if (!status) return null;

    const formatUptime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return `${h}h ${m}m`;
    };

    const items = [
        {
            icon: Server,
            label: 'Device ID',
            value: status.device_id,
            badge: status.mock_mode ? { text: 'Mock', color: 'bg-amber-500/20 text-amber-400' } : null,
        },
        {
            icon: Clock,
            label: 'Uptime',
            value: formatUptime(status.uptime_seconds),
        },
        {
            icon: HardDrive,
            label: 'Database',
            value: `${status.database_size_mb} MB`,
            sub: `${status.total_readings.toLocaleString()} readings`,
        },
        {
            icon: Wifi,
            label: 'Sensor',
            value: status.sensor_status,
            dot: status.sensor_status === 'active' ? 'bg-emerald-400' : 'bg-red-400',
        },
        {
            icon: Database,
            label: 'Unsynced',
            value: `${status.unsynced_readings.toLocaleString()} readings`,
        },
    ];

    return (
        <div className="glass-card p-6 animate-slide-up">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10">
                    <Server className="w-5 h-5 text-emerald-400" />
                </div>
                System Status
            </h3>

            <div className="space-y-3">
                {items.map(({ icon: ItemIcon, label, value, sub, badge, dot }) => (
                    <div key={label} className="flex items-center gap-3">
                        <ItemIcon className="w-4 h-4 text-gray-600" />
                        <div className="flex-1 min-w-0">
                            <span className="text-xs text-gray-500">{label}</span>
                            <div className="flex items-center gap-2">
                                {dot && <span className={`status-dot ${dot}`} />}
                                <span className="text-sm text-gray-200">{value}</span>
                                {badge && (
                                    <span className={`vital-badge ${badge.color}`}>{badge.text}</span>
                                )}
                            </div>
                            {sub && <span className="text-xs text-gray-600">{sub}</span>}
                        </div>
                    </div>
                ))}
            </div>

            {/* Sync button */}
            <button
                onClick={handleSync}
                disabled={syncing}
                className="mt-5 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                   bg-brand-600/20 hover:bg-brand-600/30 border border-brand-500/20 hover:border-brand-500/40
                   text-brand-300 text-sm font-medium transition-all duration-200
                   disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing…' : 'Sync to Central Server'}
            </button>

            {/* Sync result */}
            {syncResult && (
                <div
                    className={`mt-3 p-3 rounded-xl text-xs ${syncResult.status === 'success'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                >
                    {syncResult.status === 'success'
                        ? `✅ ${syncResult.records_sent} records synced (${syncResult.duration_ms}ms)`
                        : `❌ ${syncResult.error}`}
                </div>
            )}
        </div>
    );
}
