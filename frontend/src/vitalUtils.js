/**
 * vitalUtils.js
 * Shared helpers that translate raw vital-sign numbers into plain-English
 * status labels, range context, and short advice for non-medical users.
 */

// Per-vital metadata: normal range, unit, friendly name, and advice strings.
const VITAL_META = {
    heart_rate: {
        name: 'Heart Rate',
        unit: 'bpm',
        low: 60,
        high: 100,
        lowAdvice: 'A low heart rate can sometimes be normal for athletes, but if you feel dizzy or faint, seek medical attention.',
        highAdvice: 'Try to rest in a calm position and avoid caffeine. If it stays high or you feel chest pain, contact a doctor.',
    },
    spo2: {
        name: 'Blood Oxygen',
        unit: '%',
        low: 95,
        high: 100,
        lowAdvice: 'Low blood oxygen can be serious. Sit upright, breathe slowly and deeply. Seek medical help if below 90%.',
        highAdvice: 'Blood oxygen above 100% is a sensor anomaly — readings are normal up to 100%.',
    },
    temperature: {
        name: 'Body Temperature',
        unit: '°C',
        low: 36.1,
        high: 37.2,
        lowAdvice: 'Low body temperature can be dangerous. Warm up with blankets and warm drinks. Seek help if it persists.',
        highAdvice: 'A high temperature may indicate a fever. Rest and stay hydrated. Seek medical attention if above 39 °C.',
    },
    blood_pressure_sys: {
        name: 'Blood Pressure (Systolic)',
        unit: 'mmHg',
        low: 90,
        high: 120,
        lowAdvice: 'Low blood pressure can cause dizziness. Sit or lie down and drink water. Seek help if you feel faint.',
        highAdvice: 'High systolic pressure may indicate hypertension. Rest and avoid stress. See a doctor if it stays high.',
    },
    blood_pressure_dia: {
        name: 'Blood Pressure (Diastolic)',
        unit: 'mmHg',
        low: 60,
        high: 80,
        lowAdvice: 'Low diastolic pressure can cause dizziness. Sit or lie down and drink water.',
        highAdvice: 'High diastolic pressure may indicate hypertension. Rest and avoid stress. Consult a doctor if persistent.',
    },
    respiratory_rate: {
        name: 'Breathing Rate',
        unit: 'br/min',
        low: 12,
        high: 20,
        lowAdvice: 'Breathing very slowly can be a sign of an issue. Stay calm and take slow, deep breaths.',
        highAdvice: 'Breathing faster than normal can be caused by stress or exertion. Rest and breathe slowly. Seek help if it persists.',
    },
};

/**
 * Look up vital metadata by its key or by a display name string.
 */
function findMeta(vitalKeyOrName) {
    if (!vitalKeyOrName) return null;
    const lower = vitalKeyOrName.toLowerCase().replace(/\s+/g, '_');
    if (VITAL_META[lower]) return { key: lower, ...VITAL_META[lower] };
    for (const [key, meta] of Object.entries(VITAL_META)) {
        if (meta.name.toLowerCase() === vitalKeyOrName.toLowerCase()) {
            return { key, ...meta };
        }
    }
    return null;
}

/**
 * Given a vital value and its alert thresholds, compute a plain-English status.
 *
 * @param {number|null} value
 * @param {{ low: number, high: number }|null} alert
 * @param {string} [vitalKey]
 * @returns {{
 *   status: 'normal'|'high'|'low'|'unknown',
 *   label: string,
 *   textColor: string,
 *   bgColor: string,
 *   borderColor: string,
 *   advice: string|null,
 *   rangePct: number,
 *   normalRangeText: string,
 * }}
 */
export function getVitalStatus(value, alert, vitalKey) {
    const meta = findMeta(vitalKey);
    const effectiveAlert = alert || (meta ? { low: meta.low, high: meta.high } : null);
    const unit = meta?.unit ?? '';

    if (value == null || !effectiveAlert) {
        return {
            status: 'unknown',
            label: '—',
            textColor: 'text-gray-500',
            bgColor: 'bg-gray-500/10',
            borderColor: 'border-gray-500/20',
            advice: null,
            rangePct: 0.5,
            normalRangeText: '',
        };
    }

    const { low, high } = effectiveAlert;
    const span = high - low;
    const extended = span * 0.4;
    const visualMin = low - extended;
    const visualMax = high + extended;
    const rangePct = Math.min(1, Math.max(0, (value - visualMin) / (visualMax - visualMin)));
    const normalRangeText = `Normal: ${low}–${high} ${unit}`.trim();

    if (value < low) {
        return {
            status: 'low',
            label: 'Too Low',
            textColor: 'text-blue-400',
            bgColor: 'bg-blue-500/10',
            borderColor: 'border-blue-500/30',
            advice: meta?.lowAdvice ?? 'This reading is below the normal range. Consult a healthcare professional if you feel unwell.',
            rangePct,
            normalRangeText,
        };
    }

    if (value > high) {
        return {
            status: 'high',
            label: 'Too High',
            textColor: 'text-red-400',
            bgColor: 'bg-red-500/10',
            borderColor: 'border-red-500/30',
            advice: meta?.highAdvice ?? 'This reading is above the normal range. Consult a healthcare professional if you feel unwell.',
            rangePct,
            normalRangeText,
        };
    }

    return {
        status: 'normal',
        label: 'Normal',
        textColor: 'text-emerald-400',
        bgColor: 'bg-emerald-500/10',
        borderColor: 'border-emerald-500/20',
        advice: null,
        rangePct,
        normalRangeText,
    };
}

/**
 * Build a human-readable explanation of an alert value vs normal range.
 * e.g. "Heart Rate is 130 bpm — above the normal maximum of 100 bpm"
 */
export function formatThresholdExplanation(vitalName, value, unit, alert) {
    const meta = findMeta(vitalName);
    const effectiveAlert = alert || (meta ? { low: meta.low, high: meta.high } : null);
    const effectiveUnit = unit || meta?.unit || '';
    const name = meta?.name || vitalName || 'This vital';

    if (value == null) return '';
    if (!effectiveAlert) return `${name}: ${value} ${effectiveUnit}`.trim();

    const { low, high } = effectiveAlert;
    const isTooLow = value < low;
    const isTooHigh = value > high;

    if (!isTooLow && !isTooHigh) {
        return `${name} is ${value} ${effectiveUnit} — within the normal range (${low}–${high} ${effectiveUnit})`.trim();
    }

    const dir = isTooLow ? 'below' : 'above';
    const limitLabel = isTooLow ? 'minimum' : 'maximum';
    const limit = isTooLow ? low : high;

    return `${name} is ${value} ${effectiveUnit} — ${dir} the normal ${limitLabel} of ${limit} ${effectiveUnit}`.trim();
}

/**
 * Map a backend severity string to a friendly display label.
 */
export function friendlySeverityLabel(severity) {
    switch (severity?.toLowerCase()) {
        case 'critical': return '⚡ Act Now';
        case 'warning': return '⚠️ Attention Needed';
        default: return severity ?? 'Notice';
    }
}
