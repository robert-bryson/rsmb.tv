/** Give direct visits the same persistent, unique keys as router-created entries. */
export function initializeBrowserHistoryKey() {
    const state: unknown = window.history.state;
    const current = state !== null && typeof state === 'object' ? state : {};
    if ('key' in current && typeof current.key === 'string' && current.key) return;
    // getRandomValues also works on HTTP development origins, such as a phone's LAN URL.
    const key = window.crypto.getRandomValues(new Uint32Array(4)).join('-');
    window.history.replaceState({ ...current, key }, '');
}
