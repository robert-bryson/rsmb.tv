import { prefetchRollout, type PrefetchMode, type PrefetchRollout, type PrefetchTarget } from './prefetchTargets';

interface IntentJob {
    target: PrefetchTarget;
    destination: boolean;
    heavy: boolean;
    owners: Set<symbol>;
}

export interface PrefetchOutcome { key: string; outcome: 'prepared' | 'failed' | 'skipped' }
interface SchedulerOptions {
    prepare: (target: PrefetchTarget, destination: boolean, heavy: boolean) => Promise<unknown>;
    canStart: (heavy: boolean) => boolean;
    rollout: () => PrefetchRollout;
}

/** Limits speculative destinations. Demanded loaders never pass through this queue. */
export function createIntentScheduler({ prepare, canStart, rollout }: SchedulerOptions) {
    const timers = new Map<symbol, ReturnType<typeof setTimeout>>();
    const queue: IntentJob[] = [];
    const heavyMaps = new Set<string>();
    const outcomes: PrefetchOutcome[] = [];
    let active: IntentJob | undefined;

    const record = (key: string, outcome: PrefetchOutcome['outcome']) => {
        outcomes.push({ key, outcome });
        if (outcomes.length > 32) outcomes.shift();
    };
    const drain = () => {
        if (active) return;
        const job = queue.shift();
        if (!job) return;
        const policy = rollout();
        if (policy !== 'all') job.heavy = false;
        if (!job.owners.size || policy === 'off' || !canStart(job.heavy)
            || (job.heavy && !heavyMaps.has(job.target.page) && heavyMaps.size >= 2)) {
            record(job.target.key, 'skipped');
            drain();
            return;
        }
        if (job.heavy) heavyMaps.add(job.target.page);
        active = job;
        void Promise.resolve().then(() => prepare(job.target, job.destination, job.heavy)).then(
            () => record(job.target.key, 'prepared'),
            () => record(job.target.key, 'failed'),
        ).finally(() => { active = undefined; drain(); });
    };

    return {
        schedule(target: PrefetchTarget, mode: PrefetchMode) {
            const policy = rollout();
            if (mode === 'none' || policy === 'off') return () => {};
            const destination = mode === 'destination';
            const heavy = destination && Boolean(target.map) && policy === 'all';
            const owner = Symbol(target.key);
            const sameJob = (job: IntentJob) => job.target.key === target.key && job.destination === destination && job.heavy === heavy;
            timers.set(owner, setTimeout(() => {
                timers.delete(owner);
                if (active && sameJob(active)) return;
                const existing = queue.find(sameJob);
                if (existing) existing.owners.add(owner);
                else {
                    if (queue.length === 2) queue.shift();
                    queue.push({ target, destination, heavy, owners: new Set([owner]) });
                }
                drain();
            }, heavy ? 300 : 150));
            return () => {
                clearTimeout(timers.get(owner));
                timers.delete(owner);
                for (let index = queue.length - 1; index >= 0; index--) {
                    queue[index].owners.delete(owner);
                    if (!queue[index].owners.size) queue.splice(index, 1);
                }
            };
        },
        cancelPending() {
            for (const timer of timers.values()) clearTimeout(timer);
            timers.clear();
            queue.length = 0;
        },
        diagnostics() { return { active: active?.target.key, queued: queue.length, timers: timers.size, heavyMaps: heavyMaps.size, outcomes: [...outcomes] }; },
    };
}

export function canPrefetch(heavy: boolean) {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (document.readyState !== 'complete' || document.visibilityState === 'hidden' || navigator.onLine === false
        || connection?.saveData || ['slow-2g', '2g'].includes(connection?.effectiveType ?? '') || document.fonts?.status === 'loading') return false;
    if ([...document.images].some(image => {
        if (image.complete) return false;
        const box = image.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && box.bottom > 0 && box.right > 0 && box.top < innerHeight && box.left < innerWidth;
    })) return false;
    return !heavy || !document.querySelector('[data-map-state="loading"], [aria-busy="true"]');
}

export const intentPrefetch = createIntentScheduler({
    prepare: (target, destination, heavy) => import('./prefetchDestination').then(m => m.prepareDestination(target, destination, heavy)),
    canStart: canPrefetch,
    rollout: prefetchRollout,
});
