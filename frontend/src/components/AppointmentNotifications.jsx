import React from 'react';
import { CalendarClock, MapPin, Bell, CheckCircle2 } from 'lucide-react';
import { api } from '../api';

function formatDateTime(value) {
    if (!value) return 'Schedule pending';
    const date = new Date(value);
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}

export default function AppointmentNotifications({
    appointments,
    loading,
    unreadCount,
    onRefresh,
    onMarkRead,
}) {
    const getAppointmentSummary = (appointment) => {
        if (appointment.status === 'cancelled') {
            return `Canceled for ${formatDateTime(appointment.scheduled_for)}`;
        }

        return formatDateTime(appointment.scheduled_for);
    };

    const markAsRead = async (appointmentUuid) => {
        try {
            const updatedAppointment = await api.markAppointmentRead(appointmentUuid);
            onMarkRead?.(updatedAppointment);
            onRefresh?.();
        } catch {
            // Keep the UI stable; polling/SSE will recover if needed.
        }
    };

    if (loading) {
        return (
            <div className="glass-card p-4 sm:p-6 animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-40 mb-4" />
                <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-16 bg-gray-200 dark:bg-gray-800 rounded-xl w-full" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="glass-card p-4 sm:p-6 animate-slide-up">
            <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-brand-500/10">
                        <CalendarClock className="w-5 h-5 text-brand-500 dark:text-brand-400" />
                    </div>
                    Appointment Notifications
                </h3>
                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold bg-brand-500/10 text-brand-600 dark:text-brand-300">
                        <Bell className="w-3.5 h-3.5" />
                        {unreadCount} unread
                    </span>
                    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300">
                        {appointments.length} total
                    </span>
                </div>
            </div>

            {appointments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 px-4 py-6 text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-300">No appointment notifications yet.</p>
                    <p className="text-xs text-gray-500 mt-1">New doctor-scheduled visits will stay listed here.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {appointments.map((appointment) => (
                        <div
                            key={appointment.uuid}
                            className={`rounded-2xl px-4 py-3 border transition-colors ${appointment.read_at
                                ? 'border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40'
                                : 'border-brand-500/20 bg-brand-500/5'
                                }`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                            {appointment.title}
                                        </p>
                                        {appointment.status === 'cancelled' && (
                                            <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                                                Canceled
                                            </span>
                                        )}
                                        {appointment.read_at ? (
                                            <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-gray-700 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                                                <CheckCircle2 className="w-3 h-3" />
                                                Seen
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 rounded-full border border-brand-500/20 bg-brand-500/10 px-2 py-0.5 text-[11px] font-medium text-brand-600 dark:text-brand-300">
                                                <Bell className="w-3 h-3" />
                                                New
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-1 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                                        <CalendarClock className="w-3.5 h-3.5" />
                                        {getAppointmentSummary(appointment)}
                                    </p>
                                    {appointment.status === 'cancelled' && (
                                        <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-300 leading-relaxed">
                                            Your appointment was canceled by the doctor.
                                        </p>
                                    )}
                                    {appointment.location && (
                                        <p className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                            <MapPin className="w-3.5 h-3.5" />
                                            {appointment.location}
                                        </p>
                                    )}
                                    {appointment.notes && (
                                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                            {appointment.notes}
                                        </p>
                                    )}
                                    {appointment.created_by && (
                                        <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
                                            Scheduled by {appointment.created_by}
                                        </p>
                                    )}
                                </div>

                                {appointment.read_at ? (
                                    <span className="text-[11px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
                                        Seen {formatDateTime(appointment.read_at)}
                                    </span>
                                ) : (
                                    <button
                                        onClick={() => markAsRead(appointment.uuid)}
                                        className="inline-flex items-center gap-1 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Mark read
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
