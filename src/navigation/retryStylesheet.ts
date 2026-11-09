const pending = new Map<string, Promise<void>>();
const restored = new WeakSet<HTMLLinkElement>();

/** Retry Vite's failed same-origin CSS dependency without initializing a hidden page. */
export function retryStylesheet(href: string): Promise<void> {
    let url: URL;
    try { url = new URL(href, document.baseURI); }
    catch { return Promise.reject(new Error('Invalid stylesheet dependency')); }
    if (!/^https?:$/.test(url.protocol) || url.origin !== window.location.origin || url.username || url.password || !url.pathname.endsWith('.css')) {
        return Promise.reject(new Error('Invalid stylesheet dependency'));
    }
    const current = pending.get(url.href);
    if (current) return current;
    const previous = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].find(link => link.href === url.href);
    // A failed stylesheet can expose an empty CSSStyleSheet. Only reuse our observed success.
    if (previous?.sheet && restored.has(previous)) return Promise.resolve();
    const request = new Promise<void>((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet'; link.href = url.href; link.crossOrigin = previous?.crossOrigin ?? '';
        if (previous?.nonce) link.nonce = previous.nonce;
        if (previous?.integrity) link.integrity = previous.integrity;
        if (previous?.referrerPolicy) link.referrerPolicy = previous.referrerPolicy;
        const finish = (error?: Error) => {
            clearTimeout(timer);
            link.onload = link.onerror = null;
            if (error) {
                link.remove();
                reject(error);
            } else {
                previous?.remove();
                restored.add(link);
                resolve();
            }
        };
        const timer = setTimeout(() => finish(new Error('Stylesheet request timed out')), 15_000);
        link.onload = () => finish();
        link.onerror = () => finish(new Error('Stylesheet request failed'));
        try { document.head.append(link); }
        catch (error) { finish(error instanceof Error ? error : new Error('Stylesheet insertion failed')); }
    });
    pending.set(url.href, request);
    void request.finally(() => { if (pending.get(url.href) === request) pending.delete(url.href); }).catch(() => {});
    return request;
}
