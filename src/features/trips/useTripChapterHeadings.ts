import { useCallback, useRef } from 'react';

/** Measure chapter titles on resize; scrolling uses native CSS. */
export function useTripChapterHeadings() {
    const chapters = useRef(new Map<HTMLElement, HTMLElement>());
    const observer = useRef<ResizeObserver | undefined>(undefined);
    const header = useRef<HTMLElement | null>(null);
    const viewport = useRef<VisualViewport | null>(null);
    const frame = useRef<number | undefined>(undefined);

    const updateLayout = useCallback(() => {
        frame.current = undefined;
        const navigationHeight = header.current?.getBoundingClientRect().height ?? 0;
        const viewportHeight = viewport.current?.height ?? window.innerHeight;
        // Read every box before writing styles. Reserve at least half the
        // viewport for story text when navigation and a title are both visible.
        const measurements = Array.from(chapters.current, ([heading, chapter]) => ({
            chapter, height: heading.getBoundingClientRect().height,
        }));
        for (const { chapter, height } of measurements) {
            chapter.style.setProperty('--trip-chapter-heading-height', `${height}px`);
            chapter.toggleAttribute('data-trip-chapter-static', height + navigationHeight > viewportHeight / 2);
        }
    }, []);

    const queueUpdate = useCallback(() => {
        if (chapters.current.size === 0) return;
        frame.current ??= window.requestAnimationFrame(updateLayout);
    }, [updateLayout]);

    return useCallback((heading: HTMLElement) => {
        const chapter = heading.parentElement;
        if (!chapter?.classList.contains('trip-chapter') || chapter.firstElementChild !== heading || !heading.matches('h1, h2')) return;

        if (chapters.current.size === 0) {
            header.current = heading.closest('.site-layout')?.querySelector<HTMLElement>(':scope > .site-header') ?? null;
            viewport.current = window.visualViewport;
            if (typeof ResizeObserver !== 'undefined') {
                observer.current = new ResizeObserver(queueUpdate);
                if (header.current) observer.current.observe(header.current, { box: 'border-box' });
            }
            window.addEventListener('resize', queueUpdate, { passive: true });
            viewport.current?.addEventListener('resize', queueUpdate, { passive: true });
        }
        chapters.current.set(heading, chapter);
        observer.current?.observe(heading, { box: 'border-box' });
        queueUpdate();

        return () => {
            chapters.current.delete(heading);
            observer.current?.unobserve(heading);
            chapter.style.removeProperty('--trip-chapter-heading-height');
            chapter.removeAttribute('data-trip-chapter-static');
            if (chapters.current.size !== 0) return;
            observer.current?.disconnect();
            observer.current = undefined;
            header.current = null;
            window.removeEventListener('resize', queueUpdate);
            viewport.current?.removeEventListener('resize', queueUpdate);
            viewport.current = null;
            if (frame.current !== undefined) window.cancelAnimationFrame(frame.current);
            frame.current = undefined;
        };
    }, [queueUpdate]);
}
