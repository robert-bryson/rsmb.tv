import { useLayoutEffect, type RefObject } from 'react';

const gap = 8;
const gutter = 16;

/** Fit the body-page dropdown inside the viewport, clear of the site header. */
export function usePostFilterPosition(open: boolean, anchorRef: RefObject<HTMLElement | null>,
    panelRef: RefObject<HTMLElement | null>, onDismiss: () => void) {
    useLayoutEffect(() => {
        const anchor = anchorRef.current;
        const panel = panelRef.current;
        if (!open || !anchor || !panel) return;
        const viewport = window.visualViewport;
        const layout = anchor.closest('.site-layout');
        const header = layout?.querySelector<HTMLElement>(':scope > .site-header');
        let active = true;
        let frame: number | undefined;

        const place = () => {
            const bounds = anchor.getBoundingClientRect();
            const viewportTop = viewport?.offsetTop ?? 0;
            const viewportLeft = viewport?.offsetLeft ?? 0;
            const height = viewport?.height ?? window.innerHeight;
            const viewportRight = viewportLeft + (viewport?.width ?? (document.documentElement.clientWidth || window.innerWidth));
            // Reserve both current and target header bounds during its animation.
            const headerOffset = parseFloat(getComputedStyle(anchor).getPropertyValue('--site-header-offset')) || 0;
            const top = Math.max(viewportTop, headerOffset, header?.getBoundingClientRect().bottom ?? 0) + gutter;
            const bottom = viewportTop + height - gutter;
            if (bounds.bottom <= top || bounds.top >= bottom || bounds.right <= viewportLeft || bounds.left >= viewportRight) return false;

            const below = Math.max(0, bottom - bounds.bottom - gap);
            const above = Math.max(0, bounds.top - top - gap);
            const limit = height * 0.65;
            const fitsBelow = below >= Math.min(panel.scrollHeight, limit);
            const showBelow = fitsBelow || below >= above;
            const right = Math.max(0, bounds.right - viewportRight + gutter);
            panel.style.setProperty('--post-filter-height', `${Math.floor(Math.min(limit, showBelow ? below : above))}px`);
            panel.style.maxWidth = `${Math.max(0, Math.floor(bounds.right - right - viewportLeft - gutter))}px`;
            panel.style.top = showBelow ? `calc(100% + ${gap}px)` : 'auto';
            panel.style.bottom = showBelow ? 'auto' : `calc(100% + ${gap}px)`;
            panel.style.right = `${right}px`;
            return true;
        };
        const schedule = () => {
            if (!active || frame !== undefined) return;
            frame = window.requestAnimationFrame(() => {
                frame = undefined;
                if (active && !place()) onDismiss();
            });
        };
        if (!place()) schedule();
        const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(schedule);
        observer?.observe(anchor);
        observer?.observe(panel);
        if (header) observer?.observe(header);
        const mutations = new MutationObserver(schedule);
        if (layout) mutations.observe(layout, { attributes: true, attributeFilter: ['data-header-visible', 'style'] });
        mutations.observe(panel, { childList: true, subtree: true, characterData: true });
        window.addEventListener('resize', schedule);
        window.addEventListener('scroll', schedule, { passive: true });
        viewport?.addEventListener('resize', schedule);
        viewport?.addEventListener('scroll', schedule);
        header?.addEventListener('transitionend', schedule);
        return () => {
            active = false;
            observer?.disconnect();
            mutations.disconnect();
            if (frame !== undefined) window.cancelAnimationFrame(frame);
            window.removeEventListener('resize', schedule);
            window.removeEventListener('scroll', schedule);
            viewport?.removeEventListener('resize', schedule);
            viewport?.removeEventListener('scroll', schedule);
            header?.removeEventListener('transitionend', schedule);
        };
    }, [open, anchorRef, panelRef, onDismiss]);
}
