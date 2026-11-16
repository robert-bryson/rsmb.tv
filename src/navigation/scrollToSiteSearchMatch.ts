import type { SiteSearchMatch } from './siteSearchMatch';

function firstTextRect(range: Range): DOMRect {
    // An inline boundary can contribute an empty rect on the previous line.
    return Array.from(range.getClientRects()).find(rect => rect.width > 0 && rect.height > 0) ?? range.getBoundingClientRect();
}

function scrollDelta(start: number, size: number, visibleStart: number, visibleSize: number): number {
    const delta = start < visibleStart || size > visibleSize
        ? start - visibleStart : Math.max(0, start + size - visibleStart - visibleSize);
    // WebKit truncates fractional scroll deltas. Round toward the obscured edge.
    return delta > 0 ? Math.ceil(delta) : Math.floor(delta);
}

function revealScrollAreas(range: Range) {
    for (let parent = range.startContainer.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        const horizontal = /^(auto|scroll)$/.test(style.overflowX) && parent.scrollWidth > parent.clientWidth;
        const vertical = /^(auto|scroll)$/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight;
        if (!horizontal && !vertical) continue;
        const target = firstTextRect(range);
        const bounds = parent.getBoundingClientRect();
        const left = bounds.left + parent.clientLeft;
        const top = bounds.top + parent.clientTop;
        const dx = horizontal ? scrollDelta(target.left, target.width, left, parent.clientWidth) : 0;
        const dy = vertical ? scrollDelta(target.top, target.height, top, parent.clientHeight) : 0;
        if (dx || dy) parent.scrollBy({ left: dx, top: dy, behavior: 'instant' });
    }
}

/** Reveal the first matched line inside scroll areas, then fit it below available page chrome. */
export function scrollToSiteSearchMatch({ element, range }: SiteSearchMatch) {
    revealScrollAreas(range);
    const bounds = firstTextRect(range);
    const viewport = window.visualViewport;
    const viewportTop = viewport?.offsetTop ?? 0;
    const height = viewport?.height ?? window.innerHeight;
    const header = document.querySelector<HTMLElement>('.site-header');
    const chapter = element.closest('.trip-chapter')?.querySelector<HTMLElement>(':scope > :is(h1,h2):first-child');
    const chapterHeight = chapter && !chapter.contains(range.startContainer) && getComputedStyle(chapter).position === 'sticky'
        ? chapter.getBoundingClientRect().height : 0;
    const clearance = (header?.getBoundingClientRect().height ?? 0) + chapterHeight + 24;
    // Large navigation must not place the match below a short or zoomed viewport.
    const lastVisibleTop = viewportTop + Math.max(0, height - Math.min(bounds.height, height) - 16);
    const targetTop = Math.min(viewportTop + clearance, lastVisibleTop);
    window.scrollTo({ top: Math.max(0, window.scrollY + bounds.top - targetTop), behavior: 'instant' });
}
