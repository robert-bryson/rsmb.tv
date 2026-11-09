import { afterEach, beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => { vi.resetModules(); vi.useFakeTimers(); });
afterEach(() => {
    document.querySelectorAll('link[data-css-retry-test]').forEach(link => link.remove());
    vi.useRealTimers();
    vi.restoreAllMocks();
});

function originalLink(name = 'one') {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `/assets/review-${name}.css`;
    link.dataset.cssRetryTest = '';
    document.head.append(link);
    return link;
}

function replacement(previous: HTMLLinkElement) {
    const link = [...document.querySelectorAll<HTMLLinkElement>('link')].find(link => link.href === previous.href && link !== previous)!;
    expect(link).toBeDefined();
    link.dataset.cssRetryTest = '';
    return link;
}

it('shares a retry and preserves security attributes through another failure', async () => {
    const { retryStylesheet } = await import('../navigation/retryStylesheet');
    const original = originalLink();
    original.nonce = 'nonce-for-test'; original.integrity = 'sha384-example';
    original.crossOrigin = 'anonymous'; original.referrerPolicy = 'no-referrer';
    const first = retryStylesheet(original.href);
    expect(retryStylesheet(original.href)).toBe(first);
    const failed = replacement(original);
    const rejection = expect(first).rejects.toThrow('Stylesheet request failed');
    failed.dispatchEvent(new Event('error'));
    await rejection;
    expect(original).toBeInTheDocument();
    expect(failed).not.toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);

    const retry = retryStylesheet(original.href);
    const restored = replacement(original);
    expect(restored.nonce).toBe(original.nonce);
    expect(restored.integrity).toBe(original.integrity);
    expect(restored.crossOrigin).toBe('anonymous');
    expect(restored.referrerPolicy).toBe('no-referrer');
    Object.defineProperty(restored, 'sheet', { value: new CSSStyleSheet() });
    restored.dispatchEvent(new Event('load'));
    await retry;
    expect(original).not.toBeInTheDocument();
    await retryStylesheet(restored.href);
    expect(document.querySelectorAll(`link[href="${restored.href}"]`)).toHaveLength(1);
});

it('does not treat a replacement node with an empty sheet as an earlier observed success', async () => {
    const { retryStylesheet } = await import('../navigation/retryStylesheet');
    const original = originalLink();
    const first = retryStylesheet(original.href);
    const loaded = replacement(original);
    Object.defineProperty(loaded, 'sheet', { value: new CSSStyleSheet() });
    loaded.dispatchEvent(new Event('load')); await first;
    loaded.remove();
    const failed = originalLink();
    Object.defineProperty(failed, 'sheet', { value: new CSSStyleSheet() });
    const retry = retryStylesheet(failed.href);
    replacement(failed).dispatchEvent(new Event('load'));
    await retry;
    expect(failed).not.toBeInTheDocument();
});

it('removes a timed-out replacement and permits a later retry', async () => {
    const { retryStylesheet } = await import('../navigation/retryStylesheet');
    const original = originalLink();
    const request = retryStylesheet(original.href);
    const waiting = replacement(original);
    const rejection = expect(request).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(15_000); await rejection;
    expect(waiting).not.toBeInTheDocument();
    expect(original).toBeInTheDocument();
    const retry = retryStylesheet(original.href);
    replacement(original).dispatchEvent(new Event('load'));
    await retry;
});

it('cleans up an insertion failure instead of leaving a timer or a rejected shared entry', async () => {
    const { retryStylesheet } = await import('../navigation/retryStylesheet');
    const original = originalLink();
    vi.spyOn(document.head, 'append').mockImplementationOnce(() => { throw new Error('Cannot insert'); });
    await expect(retryStylesheet(original.href)).rejects.toThrow('Cannot insert');
    expect(vi.getTimerCount()).toBe(0);
    const retry = retryStylesheet(original.href);
    replacement(original).dispatchEvent(new Event('load'));
    await retry;
});

it.each(['https://external.example/file.css', 'http://[', '/assets/script.js',
    `blob:${window.location.origin}/file.css`, `${window.location.origin.replace('://', '://user:password@')}/file.css`])(
    'rejects an invalid dependency without inserting a link: %s', async href => {
        const { retryStylesheet } = await import('../navigation/retryStylesheet');
        const count = document.querySelectorAll('link').length;
        await expect(retryStylesheet(href)).rejects.toThrow('Invalid stylesheet dependency');
        expect(document.querySelectorAll('link')).toHaveLength(count);
    },
);
