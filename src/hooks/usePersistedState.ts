import { useState, useCallback } from 'react';

/**
 * A hook that persists state to localStorage.
 * Falls back to in-memory state if localStorage is unavailable.
 */
export function usePersistedState<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
    const [state, setState] = useState<T>(() => {
        try {
            const saved = localStorage.getItem(key);
            return saved !== null ? JSON.parse(saved) : defaultValue;
        } catch {
            return defaultValue;
        }
    });

    const setPersistedState = useCallback((value: T | ((prev: T) => T)) => {
        setState(prev => {
            const newValue = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value;
            try {
                localStorage.setItem(key, JSON.stringify(newValue));
            } catch {
                // Ignore localStorage errors (quota exceeded, etc.)
            }
            return newValue;
        });
    }, [key]);

    return [state, setPersistedState];
}
