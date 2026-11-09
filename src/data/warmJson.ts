import { fetchValidatedJson } from './validatedJson';

/** A malformed speculative response must not prevent the next demanded request from recovering. */
export async function warmJson(url: string, validate: (value: unknown) => unknown,
    { ttl, priority = 'low' }: { ttl?: number; priority?: RequestPriority } = {}) {
    await fetchValidatedJson(url, validate, { ttl, priority });
}
