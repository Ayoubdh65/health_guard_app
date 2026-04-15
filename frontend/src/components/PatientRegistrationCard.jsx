import React, { useEffect, useState } from 'react';
import { Loader2, ShieldCheck, UserRound } from 'lucide-react';

function isPlaceholderPatient(patient) {
    return (
        patient?.first_name === 'Default'
        && patient?.last_name === 'Patient'
        && patient?.medical_id === 'MED-000001'
        && !patient?.doctor_id
    );
}

function buildInitialForm(patient) {
    const placeholder = isPlaceholderPatient(patient);

    return {
        first_name: placeholder ? '' : patient?.first_name || '',
        last_name: placeholder ? '' : patient?.last_name || '',
        doctor_code: patient?.doctor_invite_code || '',
        date_of_birth: patient?.date_of_birth || '',
        medical_id: placeholder ? '' : patient?.medical_id || '',
        blood_type: patient?.blood_type || '',
        emergency_contact: patient?.emergency_contact || '',
        notes: placeholder ? '' : patient?.notes || '',
    };
}

export default function PatientRegistrationCard({ patient, onSave, saving }) {
    const [form, setForm] = useState(() => buildInitialForm(patient));
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        setForm(buildInitialForm(patient));
    }, [patient]);

    const updateField = (event) => {
        const { name, value } = event.target;
        setForm((current) => ({ ...current, [name]: value }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setSuccess('');

        try {
            const savedPatient = await onSave({
                ...form,
                first_name: form.first_name.trim(),
                last_name: form.last_name.trim(),
                doctor_code: form.doctor_code.trim().toUpperCase(),
                medical_id: form.medical_id.trim(),
                blood_type: form.blood_type.trim(),
                emergency_contact: form.emergency_contact.trim(),
                notes: form.notes.trim(),
            });
            const doctorName = savedPatient?.assigned_doctor_name;
            setSuccess(
                doctorName
                    ? `Patient registration saved locally and linked to ${doctorName}. It will sync to Supabase when internet is available.`
                    : 'Patient registration saved locally. It will sync to Supabase when internet is available.'
            );
        } catch (submitError) {
            setError(submitError.message || 'Unable to save patient registration');
        }
    };

    return (
        <section className="glass-card p-4 sm:p-6 animate-slide-up">
            <div className="flex items-start gap-3 mb-5">
                <div className="p-2 rounded-xl bg-emerald-500/10">
                    <ShieldCheck className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Register Patient
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Enter the patient profile and the doctor code shown in the doctor dashboard.
                    </p>
                </div>
            </div>

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
                            required
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
                            value={form.date_of_birth}
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

                <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 px-4 py-3 text-sm text-gray-600 dark:text-gray-300 flex items-start gap-3">
                    <UserRound className="w-4 h-4 mt-0.5 text-brand-500 dark:text-brand-400 shrink-0" />
                    <span>
                        The doctor code is verified before registration is saved. After that, the patient
                        profile is stored locally and synced to Supabase when internet is available.
                    </span>
                </div>

                {error && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">
                        {success}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={saving}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 text-white font-medium shadow-lg shadow-brand-500/20 hover:shadow-brand-500/30 hover:from-brand-500 hover:to-brand-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {saving ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Saving Registration...
                        </>
                    ) : (
                        'Save Patient Registration'
                    )}
                </button>
            </form>
        </section>
    );
}
