import { useEffect, useRef, useState } from 'react';

export function TripAtlasShare({ getUrl }: { getUrl: () => string }) {
    const [status, setStatus] = useState<'idle' | 'sharing' | 'copied' | 'manual'>('idle');
    const [url, setUrl] = useState('');
    const button = useRef<HTMLButtonElement>(null);
    const input = useRef<HTMLInputElement>(null);
    const pending = useRef(false);
    useEffect(() => {
        if (status === 'manual') { input.current?.focus(); input.current?.select(); }
        if (status !== 'copied') return;
        const timeout = window.setTimeout(() => setStatus('idle'), 3000);
        return () => window.clearTimeout(timeout);
    }, [status]);
    const close = () => { setStatus('idle'); button.current?.focus({ preventScroll: true }); };
    const share = async () => {
        if (pending.current) return;
        pending.current = true;
        const link = getUrl();
        setUrl(link);
        setStatus('sharing');
        try {
            if (navigator.share) {
                try {
                    await navigator.share({ title: 'ADV Atlas', url: link });
                    setStatus('idle');
                    return;
                } catch (error) {
                    if (error instanceof DOMException && error.name === 'AbortError') { setStatus('idle'); return; }
                }
            }
            if (!navigator.clipboard?.writeText) { setStatus('manual'); return; }
            try { await navigator.clipboard.writeText(link); setStatus('copied'); }
            catch { setStatus('manual'); }
        } finally { pending.current = false; }
    };
    return <>
        <button data-atlas-map-obstacle ref={button} type="button" aria-label="Share map" aria-expanded={status === 'manual'}
            data-atlas-tooltip={status === 'manual' ? 'Close the map-link panel.' : status === 'sharing' ? 'Sharing the current map view…' : 'Copy or share this map with its selected trip, filters, and view.'}
            aria-controls={status === 'manual' ? 'atlas-share-link' : undefined} aria-disabled={status === 'sharing' || undefined}
            onClick={() => { if (status === 'manual') close(); else void share(); }} className="atlas-control atlas-icon-control atlas-share-control">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 16V3m-4 4 4-4 4 4M7 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-2" />
            </svg>
        </button>
        <span data-atlas-map-obstacle role="status" className={status === 'copied' ? 'atlas-share-feedback atlas-surface' : 'sr-only'}>{status === 'copied' ? 'Link copied' : ''}</span>
        {status === 'manual' && <section data-atlas-map-obstacle id="atlas-share-link" aria-label="Share this map" className="atlas-share-feedback atlas-surface p-3"
            onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
            <label className="block text-sm text-zinc-200">Copy this map link
                <input ref={input} readOnly value={url} onFocus={event => event.currentTarget.select()} className="atlas-input mt-2 w-full" />
            </label>
            <p className="mt-2 text-xs text-zinc-400">Select and copy the link to share this view.</p>
            <button type="button" data-atlas-tooltip="Close the map-link panel." onClick={close} className="atlas-control mt-3 px-3">Close</button>
        </section>}
    </>;
}
