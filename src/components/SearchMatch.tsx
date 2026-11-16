import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { findSiteSearchMatch, getSiteSearchQuery } from '../navigation/siteSearchMatch';
import { scrollToSiteSearchMatch } from '../navigation/scrollToSiteSearchMatch';

const inputEvents = ['pointerdown', 'wheel', 'touchstart', 'keydown'] as const;

/** Locate lazy page text after a search visit, then yield immediately to reader input. */
export function SearchMatch() {
    const location = useLocation();
    const navigation = useNavigationType();
    useEffect(() => {
        const query = getSiteSearchQuery(location.state);
        if (!query || navigation === 'POP' || location.hash) return;
        const viewport = window.visualViewport;
        let active = true;
        let frame: number | undefined;
        let match: ReturnType<typeof findSiteSearchMatch>;
        let oriented = false;
        let previousTabIndex: string | null = null;
        let highlight: Highlight | undefined;
        let registry: HighlightRegistry | undefined;
        let timeout: number | undefined;
        const stop = () => {
            active = false;
            observer.disconnect();
            resize?.disconnect();
            if (frame !== undefined) cancelAnimationFrame(frame);
            window.clearTimeout(timeout);
            window.removeEventListener('resize', schedule);
            viewport?.removeEventListener('resize', schedule);
            viewport?.removeEventListener('scroll', schedule);
            for (const event of inputEvents) window.removeEventListener(event, stop, true);
        };
        const align = () => {
            frame = undefined;
            if (!active) return;
            const failed = document.querySelector('[data-testid="page-error"]');
            if (document.querySelector<HTMLElement>('[data-route-path]')?.dataset.routePath !== location.pathname && !failed) return;
            const main = document.querySelector<HTMLElement>('main, [role="main"]');
            if (!main) return;
            if (failed) { main.focus({ preventScroll: true }); stop(); return; }
            if (main.querySelector('[data-search-pending]')) return;
            if (!match) {
                timeout ??= window.setTimeout(stop, 8000);
                match = findSiteSearchMatch(main, query);
                if (!match) {
                    if (!oriented) { main.focus({ preventScroll: true }); oriented = true; }
                    return;
                }
                previousTabIndex = match.element.getAttribute('tabindex');
                if (previousTabIndex === null && match.element.tabIndex < 0) match.element.tabIndex = -1;
                match.element.dataset.siteSearchMatch = '';
                match.element.focus({ preventScroll: true });
                if (typeof Highlight !== 'undefined' && typeof CSS !== 'undefined' && CSS.highlights) {
                    highlight = new Highlight(match.range);
                    registry = CSS.highlights;
                    registry.set('site-search-result', highlight);
                }
                window.clearTimeout(timeout);
                timeout = window.setTimeout(stop, 3000);
            }
            if (!match.element.isConnected || match.range.collapsed) { stop(); return; }
            scrollToSiteSearchMatch(match);
        };
        const schedule = () => {
            if (active && frame === undefined) frame = requestAnimationFrame(align);
        };
        const observer = new MutationObserver(schedule);
        observer.observe(document.body, { childList: true, subtree: true, characterData: true,
            attributes: true, attributeFilter: ['data-route-path', 'data-search-pending'] });
        const resize = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(schedule);
        resize?.observe(document.body);
        window.addEventListener('resize', schedule);
        viewport?.addEventListener('resize', schedule);
        viewport?.addEventListener('scroll', schedule);
        for (const event of inputEvents) window.addEventListener(event, stop, { capture: true, passive: true });
        schedule();
        return () => {
            stop();
            if (match) {
                delete match.element.dataset.siteSearchMatch;
                if (previousTabIndex === null && match.element.getAttribute('tabindex') === '-1') match.element.removeAttribute('tabindex');
            }
            if (highlight && registry?.get('site-search-result') === highlight) registry.delete('site-search-result');
        };
    }, [location.key, location.pathname, location.hash, location.state, navigation]);
    return null;
}
