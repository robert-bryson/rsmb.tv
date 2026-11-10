import { useEffect, useRef } from 'react';
import { trackAnalyticsEvent } from '../utils/analytics';

const ENGAGED_TIME_MS = 30_000;

/** A reading proxy: the story end was visible and 30 seconds were spent visible. */
export function ArticleEngagement({ contentType }: { contentType: 'writing' | 'trip' }) {
    const end = useRef<HTMLSpanElement>(null);
    const progress = useRef({ elapsed: 0, seenEnd: false, sent: false });
    useEffect(() => {
        if (!end.current || typeof IntersectionObserver === 'undefined') return;
        const state = progress.current;
        const pathname = window.location.pathname;
        let visibleSince = document.visibilityState === 'hidden' ? null : performance.now();
        let timer: ReturnType<typeof setTimeout> | undefined;
        const account = () => {
            if (visibleSince !== null) {
                const now = performance.now();
                state.elapsed += now - visibleSince;
                visibleSince = now;
            }
        };
        const check = () => {
            account();
            if (!state.sent && state.seenEnd && state.elapsed >= ENGAGED_TIME_MS && visibleSince !== null) {
                state.sent = true;
                trackAnalyticsEvent('article-engaged', { contentType }, pathname);
            }
            schedule();
        };
        const schedule = () => {
            clearTimeout(timer);
            if (!state.sent && visibleSince !== null && state.elapsed < ENGAGED_TIME_MS) {
                timer = setTimeout(check, Math.max(1, ENGAGED_TIME_MS - state.elapsed));
            }
        };
        const visibility = () => {
            account();
            visibleSince = document.visibilityState === 'hidden' ? null : performance.now();
            check();
            schedule();
        };
        const observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting)) state.seenEnd = true;
            check();
        });
        observer.observe(end.current);
        document.addEventListener('visibilitychange', visibility);
        schedule();
        return () => {
            account();
            clearTimeout(timer);
            observer.disconnect();
            document.removeEventListener('visibilitychange', visibility);
        };
    }, [contentType]);
    return <span ref={end} aria-hidden="true" className="block h-px pointer-events-none" />;
}
