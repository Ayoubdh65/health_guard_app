import { useState, useEffect, useRef, useCallback } from 'react';
import { api, subscribeVitals } from '../api';

/** Fetch the latest vital reading, polling every `interval` ms. */
export function useLatestVital(interval = 5000) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        const fetch = async () => {
            try {
                const res = await api.getLatestVital();
                if (mounted) { setData(res); setLoading(false); }
            } catch { if (mounted) setLoading(false); }
        };

        fetch();
        const id = setInterval(fetch, interval);
        return () => { mounted = false; clearInterval(id); };
    }, [interval]);

    return { data, loading };
}

/** Accumulate real-time vitals via SSE, keeping the last `maxPoints`. */
export function useVitalStream(maxPoints = 60) {
    const [points, setPoints] = useState([]);
    const sourceRef = useRef(null);

    useEffect(() => {
        sourceRef.current = subscribeVitals((vital) => {
            setPoints((prev) => {
                const next = [...prev, vital];
                return next.length > maxPoints ? next.slice(-maxPoints) : next;
            });
        });

        return () => { sourceRef.current?.close(); };
    }, [maxPoints]);

    return points;
}

/** Fetch patient profile once. */
export function usePatient() {
    const [patient, setPatient] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const result = await api.getPatient();
            setPatient(result);
            return result;
        } catch (err) {
            setPatient(null);
            setError(err);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    const saveProfile = useCallback(async (payload) => {
        setSaving(true);
        setError(null);

        try {
            const result = patient
                ? await api.updatePatient(payload)
                : await api.createPatient(payload);
            setPatient(result);
            return result;
        } catch (err) {
            setError(err);
            throw err;
        } finally {
            setSaving(false);
        }
    }, [patient]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { patient, loading, saving, error, refresh, saveProfile, setPatient };
}

/** Fetch system status, refreshing every `interval` ms. */
export function useSystemStatus(interval = 10000) {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        const fetch = async () => {
            try {
                const res = await api.getSystemStatus();
                if (mounted) { setStatus(res); setLoading(false); }
            } catch { if (mounted) setLoading(false); }
        };

        fetch();
        const id = setInterval(fetch, interval);
        return () => { mounted = false; clearInterval(id); };
    }, [interval]);

    return { status, loading };
}

/** Fetch vital stats for the given period. */
export function useVitalStats(hours = 24) {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.getVitalStats(hours)
            .then(setStats)
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [hours]);

    return { stats, loading };
}

/** Fetch active (unacknowledged) alerts, polling every `interval` ms. */
export function useAlerts(interval = 10000) {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            const res = await api.getActiveAlerts();
            setAlerts(res);
            setLoading(false);
        } catch { setLoading(false); }
    }, []);

    useEffect(() => {
        refresh();
        const id = setInterval(refresh, interval);
        return () => clearInterval(id);
    }, [interval, refresh]);

    return { alerts, loading, refresh };
}

/** Fetch alert stats (counts), polling every `interval` ms. */
export function useAlertStats(interval = 10000) {
    const [stats, setStats] = useState({ total: 0, critical: 0, warning: 0, unacknowledged: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        const fetch = async () => {
            try {
                const res = await api.getAlertStats();
                if (mounted) { setStats(res); setLoading(false); }
            } catch { if (mounted) setLoading(false); }
        };

        fetch();
        const id = setInterval(fetch, interval);
        return () => { mounted = false; clearInterval(id); };
    }, [interval]);

    return { stats, loading };
}

/** Fetch appointment notifications, polling every `interval` ms. */
export function useAppointments(interval = 15000, unreadOnly = true) {
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            const res = await api.getAppointments(1, 6, unreadOnly);
            setAppointments(res.items || []);
            setLoading(false);
        } catch {
            setLoading(false);
        }
    }, [unreadOnly]);

    useEffect(() => {
        refresh();
        const id = setInterval(refresh, interval);
        return () => clearInterval(id);
    }, [interval, refresh]);

    return { appointments, loading, refresh, setAppointments };
}

/** Fetch appointment notification counts, polling every `interval` ms. */
export function useAppointmentStats(interval = 15000) {
    const [stats, setStats] = useState({ total: 0, unread: 0, upcoming: 0 });
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            const res = await api.getAppointmentStats();
            setStats(res);
            setLoading(false);
        } catch {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
        const id = setInterval(refresh, interval);
        return () => {
            clearInterval(id);
        };
    }, [interval, refresh]);

    return { stats, loading, refresh };
}

/** Fetch vital history for a given period. */
export function useVitalHistory(period = '24h') {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        setLoading(true);

        api.getVitalHistory(period)
            .then((res) => { if (mounted) setData(res); })
            .catch(() => { })
            .finally(() => { if (mounted) setLoading(false); });

        return () => { mounted = false; };
    }, [period]);

    return { data, loading };
}
