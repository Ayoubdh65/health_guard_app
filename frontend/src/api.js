/**
 * HealthGuard API client – talks to the FastAPI backend.
 */

const BASE = '/api';

async function request(path, options = {}) {
    const res = await fetch(`${BASE}${path}`, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`API ${res.status}: ${text}`);
    }
    return res.json();
}

export const api = {
    // Vitals
    getVitals: (page = 1, pageSize = 50) =>
        request(`/vitals?page=${page}&page_size=${pageSize}`),

    getLatestVital: () => request('/vitals/latest'),

    getVitalStats: (hours = 24) => request(`/vitals/stats?hours=${hours}`),

    // Patient
    getPatient: () => request('/patient'),

    updatePatient: (data) =>
        request('/patient', { method: 'PUT', body: JSON.stringify(data) }),

    // System
    getSystemStatus: () => request('/system/status'),

    triggerSync: () => request('/system/sync', { method: 'POST' }),
};

/**
 * Connect to SSE stream for real-time vital updates.
 * Returns an EventSource instance; call .close() to disconnect.
 */
export function subscribeVitals(onData) {
    const source = new EventSource(`${BASE}/vitals/stream`);
    source.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            onData(data);
        } catch (err) {
            console.error('SSE parse error:', err);
        }
    };
    source.onerror = () => {
        console.warn('SSE connection error, will auto-reconnect…');
    };
    return source;
}
