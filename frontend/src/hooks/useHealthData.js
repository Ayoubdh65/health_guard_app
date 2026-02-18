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

    useEffect(() => {
        api.getPatient()
            .then(setPatient)
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    return { patient, loading, setPatient };
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
