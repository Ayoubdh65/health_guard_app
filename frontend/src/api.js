/**
 * HealthGuard API client – talks to the FastAPI backend.
 * Includes JWT token management for authenticated requests.
 */

const BASE = '/api';

// ── Token helpers ──────────────────────────────────────────────────────────

export function getToken() {
    return localStorage.getItem('hg_token');
}

export function getStoredUser() {
    try {
        return JSON.parse(localStorage.getItem('hg_user'));
    } catch {
        return null;
    }
}

export function clearAuth() {
    localStorage.removeItem('hg_token');
    localStorage.removeItem('hg_user');
}

// ── Core request helper ────────────────────────────────────────────────────

async function request(path, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${BASE}${path}`, { ...options, headers });

    // Auto-logout on 401
    if (res.status === 401) {
        clearAuth();
        window.dispatchEvent(new Event('hg:logout'));
        throw new Error('Session expired');
    }

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `API ${res.status}`);
    }

    return res.json();
}

// ── API methods ────────────────────────────────────────────────────────────

export const api = {
    // Auth
    login: (username, password) =>
        request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        }),

    getMe: () => request('/auth/me'),

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

    // Alerts
    getAlerts: (page = 1, severity = '', acknowledged = '') => {
        let url = `/alerts?page=${page}`;
        if (severity) url += `&severity=${severity}`;
        if (acknowledged !== '') url += `&acknowledged=${acknowledged}`;
        return request(url);
    },

    getActiveAlerts: () => request('/alerts/active'),

    acknowledgeAlert: (id) => request(`/alerts/${id}/acknowledge`, { method: 'POST' }),

    getAlertStats: () => request('/alerts/stats'),

    // History
    getVitalHistory: (period = '24h') => request(`/vitals/history?period=${period}`),
};

/**
 * Connect to SSE stream for real-time vital updates.
 * Passes JWT token as query parameter since EventSource can't set headers.
 * Returns an EventSource instance; call .close() to disconnect.
 */
export function subscribeVitals(onData) {
    const token = getToken();
    const url = token
        ? `${BASE}/vitals/stream?token=${encodeURIComponent(token)}`
        : `${BASE}/vitals/stream`;

    const source = new EventSource(url);
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

/**
 * Connect to SSE stream for real-time alert notifications.
 * Pushes alert data as soon as the backend detects anomalies.
 * Returns an EventSource instance; call .close() to disconnect.
 */
export function subscribeAlerts(onData) {
    const token = getToken();
    const url = token
        ? `${BASE}/alerts/stream?token=${encodeURIComponent(token)}`
        : `${BASE}/alerts/stream`;

    const source = new EventSource(url);
    source.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            onData(data);
        } catch (err) {
            console.error('Alert SSE parse error:', err);
        }
    };
    source.onerror = () => {
        console.warn('Alert SSE connection error, will auto-reconnect…');
    };
    return source;
}
