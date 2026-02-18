import React from 'react';
import { User, Calendar, Droplets, Phone, FileText } from 'lucide-react';

/**
 * PatientInfo – Glassmorphism card showing the patient profile.
 *
 * Props:
 *  - patient: patient object from API
 *  - loading: boolean
 */
export default function PatientInfo({ patient, loading }) {
    if (loading) {
        return (
            <div className="glass-card p-6 animate-pulse">
                <div className="h-4 bg-gray-800 rounded w-32 mb-4" />
                <div className="space-y-3">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-3 bg-gray-800 rounded w-full" />
                    ))}
                </div>
            </div>
        );
    }

    if (!patient) {
        return (
            <div className="glass-card p-6">
                <p className="text-gray-500 text-sm">No patient profile configured</p>
            </div>
        );
    }

    const fields = [
        { icon: User, label: 'Name', value: `${patient.first_name} ${patient.last_name}` },
        { icon: Calendar, label: 'DOB', value: patient.date_of_birth || '—' },
        { icon: Droplets, label: 'Blood Type', value: patient.blood_type || '—' },
        { icon: FileText, label: 'Medical ID', value: patient.medical_id || '—' },
        { icon: Phone, label: 'Emergency', value: patient.emergency_contact || '—' },
    ];

    return (
        <div className="glass-card p-6 animate-slide-up">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <div className="p-2 rounded-xl bg-brand-500/10">
                    <User className="w-5 h-5 text-brand-400" />
                </div>
                Patient Profile
            </h3>

            <div className="space-y-3">
                {fields.map(({ icon: FieldIcon, label, value }) => (
                    <div key={label} className="flex items-center gap-3 group">
                        <FieldIcon className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
                        <div className="flex-1 min-w-0">
                            <span className="text-xs text-gray-500 block">{label}</span>
                            <span className="text-sm text-gray-200 truncate block">{value}</span>
                        </div>
                    </div>
                ))}
            </div>

            {patient.notes && (
                <div className="mt-4 pt-4 border-t border-gray-800/50">
                    <p className="text-xs text-gray-500 mb-1">Notes</p>
                    <p className="text-sm text-gray-300 leading-relaxed">{patient.notes}</p>
                </div>
            )}
        </div>
    );
}
