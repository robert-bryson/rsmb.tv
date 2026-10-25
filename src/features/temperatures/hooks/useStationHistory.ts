import { useState, useEffect, useCallback } from 'react';
import { parseTemperaturePayload, stationHistorySchema } from '../schemas';

const ACIS_URL = 'https://data.rcc-acis.org/StnData';
const REQUEST_TIMEOUT_MS = 30_000;

function observationValue(value: unknown): number | null {
    if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

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
        setLoading(false);
        setError(null);
        setRequest(null);
    }, []);

    useEffect(() => {
        if (!request) return;

        let cancelled = false;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(new Error('Station history request timed out. Please try again.')), REQUEST_TIMEOUT_MS);
        const { uid, years } = request;

        async function load() {
            setLoading(true);
            setError(null);
            setHistory(null);

            try {
                const now = new Date();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const startYear = now.getFullYear() - years;
                const lastDay = new Date(startYear, now.getMonth() + 1, 0).getDate();
                const startDay = Math.min(now.getDate(), lastDay);
                const edate = `${now.getFullYear()}-${month}-${String(now.getDate()).padStart(2, '0')}`;
                const sdate = `${startYear}-${month}-${String(startDay).padStart(2, '0')}`;

                const res = await fetch(ACIS_URL, {
                    method: 'POST',
                    signal: controller.signal,
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
                const payload: unknown = await res.json();
                if (cancelled) return;
                const json = parseTemperaturePayload(stationHistorySchema, payload, 'station history data');
                if (json.error) throw new Error(json.error);

                const meta: StationMeta = {
                    uid: json.meta?.uid ?? uid,
                    name: json.meta?.name ?? 'Unknown',
                    ll: json.meta?.ll ?? [0, 0],
                    state: json.meta?.state ?? '',
                    elev: json.meta?.elev ?? null,
                    sids: json.meta?.sids ?? [],
                };

                const data: StationDailyObs[] = (json.data ?? []).map(
                    (row) => ({
                        date: row[0],
                        maxt: observationValue(row[1]),
                        mint: observationValue(row[2]),
                        pcpn: observationValue(row[3]),
                    })
                );

                setHistory({ meta, data });
            } catch (err) {
                if (!cancelled) {
                    const failure = controller.signal.aborted ? controller.signal.reason : err;
                    setError(failure instanceof Error ? failure.message : 'Failed to load station history');
                }
            } finally {
                clearTimeout(timeoutId);
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
            controller.abort();
        };
    }, [request]);

    return { history, loading, error, fetch: fetchStation, clear };
}
