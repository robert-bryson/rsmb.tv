import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
const positions = new Map<string, number>();
const listPositions = new Map<string, number>();

export function ScrollToTop() {
    const previousPath = useRef<string | undefined>(undefined);
    const location = useLocation();
    const navigation = useNavigationType();
    useLayoutEffect(() => {
        const previous = window.history.scrollRestoration;
        window.history.scrollRestoration = 'manual';
        const url = location.pathname + location.search;
        const returning = (location.state as { restoreScroll?: boolean } | null)?.restoreScroll;
        const samePath = previousPath.current === location.pathname;
        previousPath.current = location.pathname;
        const target = navigation === 'POP' ? positions.get(location.key) ?? 0 : returning ? listPositions.get(url) ?? 0 : samePath ? window.scrollY : 0;
        let restoring = true;
        let frame = 0;
        const restore = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                if (!restoring) return;
                const hash = location.hash;
                let anchor: HTMLElement | null = null;
                try { anchor = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null; } catch { /* malformed fragment */ }
                if (anchor) anchor.scrollIntoView();
                else if (!hash) window.scrollTo(0, target);
            });
        };
        if (!location.hash && (!samePath || navigation === 'POP' || returning)) window.scrollTo(0, target);
        else if (location.hash) restore();
        const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(restore);
        observer?.observe(document.body);
        const stop = () => { restoring = false; observer?.disconnect(); };
        const timeout = window.setTimeout(stop, 3000);
        window.addEventListener('wheel', stop, { passive: true });
        window.addEventListener('touchstart', stop, { passive: true });
        window.addEventListener('keydown', stop);
        const remember = () => {
            positions.set(location.key, window.scrollY);
            if (location.pathname === '/posts') listPositions.set(url, window.scrollY);
        };
        window.addEventListener('scroll', remember, { passive: true });
        return () => {
            stop(); cancelAnimationFrame(frame); clearTimeout(timeout);
            window.removeEventListener('scroll', remember);
            window.removeEventListener('wheel', stop); window.removeEventListener('touchstart', stop); window.removeEventListener('keydown', stop);
            window.history.scrollRestoration = previous;
        };
    }, [location.key, location.pathname, location.search, location.hash, location.state, navigation]);
    return null;
}
