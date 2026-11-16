import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scrollToSiteSearchMatch } from '../navigation/scrollToSiteSearchMatch';

let rects: DOMRect[];
let range: Range;
let element: HTMLElement;
let scroll: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    vi.stubGlobal('innerHeight', 600);
    vi.stubGlobal('scrollY', 0);
    vi.stubGlobal('visualViewport', undefined);
    document.body.innerHTML = '<header class="site-header"></header><main><p>Quiet harbor.</p></main>';
    element = document.querySelector('p')!;
    document.querySelector('header')!.getBoundingClientRect = () => new DOMRect(0, 0, 400, 72);
    rects = [new DOMRect(200, 600, 100, 24)];
    range = document.createRange();
    range.selectNodeContents(element.firstChild!);
    range.getClientRects = () => rects as unknown as DOMRectList;
    range.getBoundingClientRect = () => rects[rects.length - 1];
    scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function reveal() { scrollToSiteSearchMatch({ element, range }); }

function scroller(overflowX = 'auto', overflowY = 'auto') {
    const area = document.createElement('div');
    area.style.overflowX = overflowX;
    area.style.overflowY = overflowY;
    element.replaceWith(area);
    area.append(element);
    range.selectNodeContents(element.firstChild!);
    Object.defineProperties(area, {
        clientWidth: { value: 80 }, clientHeight: { value: 100 },
        clientLeft: { value: 2 }, clientTop: { value: 3 },
        scrollWidth: { value: 400 }, scrollHeight: { value: 800 },
    });
    area.getBoundingClientRect = () => new DOMRect(20, 30, 84, 106);
    Object.defineProperty(area, 'scrollBy', { value: vi.fn((options: ScrollToOptions) => {
        rects = rects.map(rect => new DOMRect(rect.x - (options.left ?? 0), rect.y - (options.top ?? 0), rect.width, rect.height));
    }) });
    return area;
}

describe('search match review regressions: passage geometry', () => {
    it('keeps the matched line below the site navigation', () => {
        reveal();
        expect(scroll).toHaveBeenLastCalledWith({ top: 504, behavior: 'instant' });
    });

    it.each(['static', 'sticky'])('reserves chapter height only when it remains sticky: %s', position => {
        const chapter = document.createElement('section');
        chapter.className = 'trip-chapter';
        chapter.innerHTML = `<h2 style="position:${position}">First day</h2>`;
        element.replaceWith(chapter);
        chapter.append(element);
        range.selectNodeContents(element.firstChild!);
        chapter.querySelector('h2')!.getBoundingClientRect = () => new DOMRect(0, 0, 400, 60);
        reveal();
        expect(scroll).toHaveBeenLastCalledWith({ top: position === 'sticky' ? 444 : 504, behavior: 'instant' });
    });

    it('respects the visual viewport offset and reduced visible height', () => {
        vi.stubGlobal('visualViewport', { offsetTop: 120, height: 100 });
        reveal();
        expect(scroll).toHaveBeenLastCalledWith({ top: 420, behavior: 'instant' });
    });

    it('fits enlarged text inside a short viewport instead of reserving an impossible clearance', () => {
        vi.stubGlobal('innerHeight', 240);
        document.querySelector('header')!.getBoundingClientRect = () => new DOMRect(0, 0, 400, 180);
        rects = [new DOMRect(0, 600, 200, 50)];
        reveal();
        expect(scroll).toHaveBeenLastCalledWith({ top: 426, behavior: 'instant' });
    });

    it('ignores an empty inline boundary on the line before the actual match', () => {
        rects.unshift(new DOMRect(100, 200, 0, 24));
        reveal();
        expect(scroll).toHaveBeenLastCalledWith({ top: 504, behavior: 'instant' });
    });

    it('uses a bounding rect when the engine provides no fragment rects', () => {
        range.getClientRects = () => [] as unknown as DOMRectList;
        reveal();
        expect(scroll).toHaveBeenLastCalledWith({ top: 504, behavior: 'instant' });
    });

    it('never scrolls above the document or below the top of an oversized text line', () => {
        rects = [new DOMRect(0, 20, 200, 900)];
        reveal();
        expect(scroll).toHaveBeenLastCalledWith({ top: 20, behavior: 'instant' });
        rects = [new DOMRect(0, 20, 200, 24)];
        reveal();
        expect(scroll).toHaveBeenLastCalledWith({ top: 0, behavior: 'instant' });
    });

    it('reveals both axes within scroll areas and accounts for their borders', () => {
        rects = [new DOMRect(200, 400, 40, 24)];
        const area = scroller();
        reveal();
        expect(area.scrollBy).toHaveBeenCalledWith({ left: 138, top: 291, behavior: 'instant' });
        expect(scroll).toHaveBeenLastCalledWith({ top: 13, behavior: 'instant' });
    });

    it.each([
        [new DOMRect(200.2, 400.8, 40.1, 24.4), 139, 293],
        [new DOMRect(-50.2, -20.2, 40, 24), -73, -54],
    ])('rounds fractional deltas outward for whole-pixel scroll engines', (rect, left, top) => {
        rects = [rect];
        const area = scroller();
        reveal();
        expect(area.scrollBy).toHaveBeenCalledWith({ left, top, behavior: 'instant' });
    });

    it('does not move an already visible scroll area or a clipped area without scroll controls', () => {
        rects = [new DOMRect(30, 40, 40, 24)];
        const area = scroller();
        reveal();
        expect(area.scrollBy).not.toHaveBeenCalled();
        rects = [new DOMRect(500, 600, 40, 24)];
        area.style.overflowX = 'hidden';
        area.style.overflowY = 'clip';
        reveal();
        expect(area.scrollBy).not.toHaveBeenCalled();
    });

    it('shows the start of an oversized match rather than its last characters', () => {
        rects = [new DOMRect(200, 400, 200, 200)];
        const area = scroller();
        reveal();
        expect(area.scrollBy).toHaveBeenCalledWith({ left: 178, top: 367, behavior: 'instant' });
    });
});
