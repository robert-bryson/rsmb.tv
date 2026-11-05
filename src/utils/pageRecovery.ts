const STORAGE_KEY = 'rsmb:page-recovery:v2';
const RETRY_WINDOW_MS = 60_000;
const MAX_TRACKED_ROUTES = 32;

interface RecoveryOptions {
    storage?: () => Pick<Storage, 'getItem' | 'setItem'>;
    now?: () => number;
    reload?: () => void;
}

/** Remember recent route failures across reloads. Query/hash changes share a limit. */
export function createPageRecovery({ storage = () => sessionStorage, now = Date.now, reload = () => window.location.reload() }: RecoveryOptions = {}) {
    const attempts = new Map<string, number>();
    return (url: string): boolean => {
        const route = new URL(url).pathname;
        const timestamp = now();
        try {
            const saved: unknown = JSON.parse(storage().getItem(STORAGE_KEY) ?? '[]');
            if (Array.isArray(saved)) {
                const persisted = saved.filter((entry): entry is [string, number] => Array.isArray(entry)
                    && typeof entry[0] === 'string' && typeof entry[1] === 'number' && Number.isFinite(entry[1])
                    && entry[1] <= timestamp && timestamp - entry[1] < RETRY_WINDOW_MS).slice(-MAX_TRACKED_ROUTES);
                for (const [path, at] of persisted) attempts.set(path, Math.max(attempts.get(path) ?? -Infinity, at));
            }
        } catch { /* Keep this document's history if storage is unavailable. */ }
        for (const [path, at] of attempts) if (at > timestamp || timestamp - at >= RETRY_WINDOW_MS) attempts.delete(path);
        if (attempts.has(route)) return false;
        attempts.set(route, timestamp);
        while (attempts.size > MAX_TRACKED_ROUTES) attempts.delete(attempts.keys().next().value!);
        try { storage().setItem(STORAGE_KEY, JSON.stringify([...attempts])); }
        catch { /* Recovery remains manual when persistent storage is blocked. */ }
        reload();
        return true;
    };
}

const retryPage = createPageRecovery();
export function retryCurrentPage(): boolean {
    return retryPage(window.location.href);
}
