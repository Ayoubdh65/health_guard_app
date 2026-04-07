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

export default function AppointmentNotifications({ appointments, loading, unreadCount, onRefresh }) {
    const markAsRead = async (appointmentUuid) => {
        try {
            await api.markAppointmentRead(appointmentUuid);
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
                    Appointments
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold bg-brand-500/10 text-brand-600 dark:text-brand-300">
                    <Bell className="w-3.5 h-3.5" />
                    {unreadCount} unread
                </span>
            </div>

            {appointments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 px-4 py-6 text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-300">No new appointment notifications.</p>
                    <p className="text-xs text-gray-500 mt-1">New doctor-scheduled visits will appear here.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {appointments.map((appointment) => (
                        <div
                            key={appointment.uuid}
                            className="rounded-2xl border border-brand-500/20 bg-brand-500/5 px-4 py-3"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {appointment.title}
                                    </p>
                                    <p className="mt-1 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                                        <CalendarClock className="w-3.5 h-3.5" />
                                        {formatDateTime(appointment.scheduled_for)}
                                    </p>
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

                                <button
                                    onClick={() => markAsRead(appointment.uuid)}
                                    className="inline-flex items-center gap-1 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Mark read
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
