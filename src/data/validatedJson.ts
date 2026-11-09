import { discardCachedValue, fetchWithCache } from './fetchCache';

/** Validate shared JSON before use and discard only the rejected cache value. */
export async function fetchValidatedJson<T>(url: string, validate: (value: unknown) => T,
    options?: Parameters<typeof fetchWithCache>[1]): Promise<T> {
    const value = await fetchWithCache<unknown>(url, options);
    try { return await validate(value); }
    catch (error) { discardCachedValue(url, value); throw error; }
}
