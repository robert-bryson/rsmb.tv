import { useState, useEffect, useCallback } from 'react';

const ACIS_URL = 'https://data.rcc-acis.org/StnData';

export interface StationDailyObs {
    date: string;
    maxt: number | null;
    mint: number | null;
    pcpn: number | null;
}

export interface StationMeta {
    uid: number;
    name: string;
    ll: [number, number];
    state: string;
    elev: number | null;
    sids: string[];
}

export interface StationHistory {
    meta: StationMeta;
    data: StationDailyObs[];
}

interface UseStationHistoryState {
    history: StationHistory | null;
    loading: boolean;
    error: string | null;
    fetch: (uid: number, years?: number) => void;
    clear: () => void;
}

/**
 * Fetches station observation history directly from the ACIS StnData endpoint.
 * Triggered on demand when a user selects a station on the map.
 */
export function useStationHistory(): UseStationHistoryState {
    const [history, setHistory] = useState<StationHistory | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [request, setRequest] = useState<{ uid: number; years: number } | null>(null);

    const fetchStation = useCallback((uid: number, years = 5) => {
        setRequest({ uid, years });
    }, []);

    const clear = useCallback(() => {
        setHistory(null);
        setError(null);
        setRequest(null);
    }, []);

    useEffect(() => {
        if (!request) return;

        let cancelled = false;
        const { uid, years } = request;

        async function load() {
            setLoading(true);
            setError(null);

            try {
                const now = new Date();
                const edate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                const sdate = `${now.getFullYear() - years}-${edate.slice(5)}`;

                const res = await fetch(ACIS_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        uid,
                        sdate,
                        edate,
                        meta: ['name', 'll', 'state', 'elev', 'uid', 'sids'],
                        elems: ['maxt', 'mint', 'pcpn'],
                    }),
                });

                if (!res.ok) throw new Error(`ACIS returned ${res.status}`);
                const json = await res.json();
                if (json.error) throw new Error(json.error);
                if (cancelled) return;

                const meta: StationMeta = {
                    uid: json.meta?.uid ?? uid,
                    name: json.meta?.name ?? 'Unknown',
                    ll: json.meta?.ll ?? [0, 0],
                    state: json.meta?.state ?? '',
                    elev: json.meta?.elev ?? null,
                    sids: json.meta?.sids ?? [],
                };

                const data: StationDailyObs[] = (json.data ?? []).map(
                    (row: [string, string, string, string]) => ({
                        date: row[0],
                        maxt: row[1] !== 'M' && row[1] !== 'T' ? parseFloat(row[1]) : null,
                        mint: row[2] !== 'M' && row[2] !== 'T' ? parseFloat(row[2]) : null,
                        pcpn: row[3] !== 'M' && row[3] !== 'T' ? parseFloat(row[3]) : null,
                    })
                );

                setHistory({ meta, data });
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Failed to load station history');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => { cancelled = true; };
    }, [request]);

    return { history, loading, error, fetch: fetchStation, clear };
}
