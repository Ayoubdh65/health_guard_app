import React, { useEffect, useState } from 'react';
import { Calendar, Droplets, Edit3, FileText, Loader2, Phone, Save, User, X } from 'lucide-react';

function buildForm(patient) {
    return {
        first_name: patient?.first_name || '',
        last_name: patient?.last_name || '',
        doctor_code: patient?.doctor_invite_code || '',
        date_of_birth: patient?.date_of_birth || '',
        medical_id: patient?.medical_id || '',
        blood_type: patient?.blood_type || '',
        emergency_contact: patient?.emergency_contact || '',
        notes: patient?.notes || '',
    };
}

export default function PatientInfo({ patient, loading, onSave, saving = false }) {
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState(() => buildForm(patient));
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        setForm(buildForm(patient));
    }, [patient]);

    if (loading) {
        return (
            <div className="glass-card p-4 sm:p-6 animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-32 mb-4" />
                <div className="space-y-3">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-full" />
                    ))}
                </div>
            </div>
        );
    }

    if (!patient) {
        return (
            <div className="glass-card p-4 sm:p-6">
                <p className="text-gray-500 text-sm">
                    Register this device to a patient profile to start syncing with the doctor dashboard.
                </p>
            </div>
        );
    }

    const updateField = (event) => {
        const { name, value } = event.target;
        setForm((current) => ({ ...current, [name]: value }));
    };

    const cancelEdit = () => {
        setForm(buildForm(patient));
        setError('');
        setSuccess('');
        setEditing(false);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setSuccess('');

        const payload = {
            first_name: form.first_name.trim(),
            last_name: form.last_name.trim(),
            date_of_birth: form.date_of_birth || null,
            medical_id: form.medical_id.trim(),
            blood_type: form.blood_type.trim(),
            emergency_contact: form.emergency_contact.trim(),
            notes: form.notes.trim(),
        };

        const doctorCode = form.doctor_code.trim().toUpperCase();
        if (doctorCode && doctorCode !== patient?.doctor_invite_code) {
            payload.doctor_code = doctorCode;
        }

        try {
            await onSave(payload);
            setSuccess('Patient profile updated.');
            setEditing(false);
        } catch (submitError) {
            setError(submitError.message || 'Unable to update patient profile');
        }
    };

    const fields = [
        { icon: User, label: 'Name', value: `${patient.first_name} ${patient.last_name}` },
        { icon: Calendar, label: 'DOB', value: patient.date_of_birth || '-' },
        { icon: Droplets, label: 'Blood Type', value: patient.blood_type || '-' },
        { icon: FileText, label: 'Medical ID', value: patient.medical_id || '-' },
        { icon: Phone, label: 'Emergency', value: patient.emergency_contact || '-' },
    ];

    return (
        <div className="glass-card p-4 sm:p-6 animate-slide-up">
            <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-brand-500/10">
                        <User className="w-5 h-5 text-brand-500 dark:text-brand-400" />
                    </div>
                    Patient Profile
                </h3>

                {!editing && onSave && (
                    <button
                        type="button"
                        onClick={() => {
                            setError('');
                            setSuccess('');
                            setEditing(true);
                        }}
                        className="h-9 w-9 rounded-lg border border-gray-200/70 dark:border-gray-800/70 bg-white/70 dark:bg-gray-950/40 text-gray-500 hover:text-brand-600 dark:hover:text-brand-300 hover:border-brand-400/50 transition-all duration-200 flex items-center justify-center"
                        aria-label="Edit patient profile"
                        title="Edit patient profile"
                    >
                        <Edit3 className="w-4 h-4" />
                    </button>
                )}
            </div>

            {editing ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="block">
                            <span className="text-xs text-gray-500 dark:text-gray-400">First Name</span>
                            <input
                                className="mt-1 w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800/60 text-gray-900 dark:text-white focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/25 transition-all duration-200"
                                name="first_name"
                                onChange={updateField}
                                required
                                value={form.first_name}
                            />
                        </label>

                        <label className="block">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Last Name</span>
                            <input
                                className="mt-1 w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800/60 text-gray-900 dark:text-white focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/25 transition-all duration-200"
                                name="last_name"
                                onChange={updateField}
                                required
                                value={form.last_name}
                            />
                        </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="block">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Medical ID</span>
                            <input
                                className="mt-1 w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800/60 text-gray-900 dark:text-white focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/25 transition-all duration-200"
                                name="medical_id"
                                onChange={updateField}
                                required
                                value={form.medical_id}
                            />
                        </label>

                        <label className="block">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Doctor Code</span>
                            <input
                                className="mt-1 w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800/60 text-gray-900 dark:text-white focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/25 transition-all duration-200"
                                name="doctor_code"
                                onChange={updateField}
                                placeholder="Example: HG-4K9M2Q"
                                value={form.doctor_code}
                            />
                        </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="block">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Date of Birth</span>
                            <input
                                className="mt-1 w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800/60 text-gray-900 dark:text-white focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/25 transition-all duration-200"
                                name="date_of_birth"
                                onChange={updateField}
                                type="date"
                                value={form.date_of_birth || ''}
                            />
                        </label>

                        <label className="block">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Blood Type</span>
                            <input
                                className="mt-1 w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800/60 text-gray-900 dark:text-white focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/25 transition-all duration-200"
                                name="blood_type"
                                onChange={updateField}
                                placeholder="A+, O-, ..."
                                value={form.blood_type}
                            />
                        </label>
                    </div>

                    <label className="block">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Emergency Contact</span>
                        <input
                            className="mt-1 w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800/60 text-gray-900 dark:text-white focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/25 transition-all duration-200"
                            name="emergency_contact"
                            onChange={updateField}
                            value={form.emergency_contact}
                        />
                    </label>

                    <label className="block">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Notes</span>
                        <textarea
                            className="mt-1 w-full min-h-[96px] px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800/60 text-gray-900 dark:text-white focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/25 transition-all duration-200 resize-y"
                            name="notes"
                            onChange={updateField}
                            value={form.notes}
                        />
                    </label>

                    {error && (
                        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={cancelEdit}
                            disabled={saving}
                            className="py-2.5 rounded-xl border border-gray-200/70 dark:border-gray-800/70 text-gray-600 dark:text-gray-300 font-medium hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <X className="w-4 h-4" />
                            Cancel
                        </button>

                        <button
                            type="submit"
                            disabled={saving}
                            className="py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 text-white font-medium shadow-lg shadow-brand-500/20 hover:shadow-brand-500/30 hover:from-brand-500 hover:to-brand-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Saving
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Save
                                </>
                            )}
                        </button>
                    </div>
                </form>
            ) : (
                <div className="space-y-3">
                    {fields.map(({ icon: FieldIcon, label, value }) => (
                        <div key={label} className="flex items-center gap-3 group">
                            <FieldIcon className="w-4 h-4 text-gray-400 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 transition-colors" />
                            <div className="flex-1 min-w-0">
                                <span className="text-xs text-gray-500 block">{label}</span>
                                <span className="text-sm text-gray-700 dark:text-gray-200 truncate block">{value}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {!editing && patient.notes && (
                <div className="mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-800/50">
                    <p className="text-xs text-gray-500 mb-1">Notes</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{patient.notes}</p>
                </div>
            )}

            {!editing && success && (
                <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">
                    {success}
                </div>
            )}
        </div>
    );
}
