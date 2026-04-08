import { useState } from 'react';

/**
 * Buffers numeric values extracted from poll data into a keyed history map.
 * Each key (e.g. a domain name) gets its own ring buffer of up to `maxPoints` values.
 *
 * Uses the "adjusting state during render" pattern recommended by React
 * for deriving state from changed props without effects.
 */
export function useTimeSeries<T>(
    data: T | null,
    extract: (data: T) => Record<string, number | null>,
    maxPoints = 20,
): Record<string, number[]> {
    const [prevData, setPrevData] = useState<T | null>(null);
    const [history, setHistory] = useState<Record<string, number[]>>({});

    if (data !== null && data !== prevData) {
        setPrevData(data);

        const extracted = extract(data);
        const next = { ...history };
        let changed = false;
        for (const [key, value] of Object.entries(extracted)) {
            if (value == null) continue;
            changed = true;
            const arr = [...(next[key] ?? []), value];
            next[key] = arr.length > maxPoints ? arr.slice(-maxPoints) : arr;
        }
        if (changed) setHistory(next);
    }

    return history;
}
