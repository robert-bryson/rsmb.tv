import { StrictMode } from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArticleEngagement } from '../components/ArticleEngagement';
import { trackAnalyticsEvent } from '../utils/analytics';
import { useMapInteraction } from '../hooks/useMapInteraction';

vi.mock('../utils/analytics', () => ({ trackAnalyticsEvent: vi.fn() }));
let intersect: IntersectionObserverCallback;
let visibility: DocumentVisibilityState;
beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    visibility = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
    vi.stubGlobal('IntersectionObserver', class {
        constructor(callback: IntersectionObserverCallback) { intersect = callback; }
        observe() {}
        disconnect() {}
    });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

function seeEnd() {
    act(() => intersect([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
}
function changeVisibility(value: DocumentVisibilityState) {
    visibility = value;
    act(() => document.dispatchEvent(new Event('visibilitychange')));
}

describe('meaningful engagement', () => {
    it('requires both visible time and the story end, and fires once under Strict Mode', () => {
        render(<StrictMode><ArticleEngagement contentType="trip" /></StrictMode>);
        act(() => vi.advanceTimersByTime(30_000));
        expect(trackAnalyticsEvent).not.toHaveBeenCalled();
        seeEnd();
        expect(trackAnalyticsEvent).toHaveBeenCalledExactlyOnceWith('article-engaged', { contentType: 'trip' }, '/');
        seeEnd();
        changeVisibility('hidden');
        changeVisibility('visible');
        expect(trackAnalyticsEvent).toHaveBeenCalledOnce();
    });

    it('does not count time spent in a hidden tab', () => {
        render(<ArticleEngagement contentType="writing" />);
        seeEnd();
        act(() => vi.advanceTimersByTime(10_000));
        changeVisibility('hidden');
        act(() => vi.advanceTimersByTime(60_000));
        expect(trackAnalyticsEvent).not.toHaveBeenCalled();
        changeVisibility('visible');
        act(() => vi.advanceTimersByTime(19_999));
        expect(trackAnalyticsEvent).not.toHaveBeenCalled();
        act(() => vi.advanceTimersByTime(1));
        expect(trackAnalyticsEvent).toHaveBeenCalledOnce();
    });

    it('cancels an unfinished reading measurement when the article unmounts', () => {
        const view = render(<ArticleEngagement contentType="writing" />);
        seeEnd();
        act(() => vi.advanceTimersByTime(20_000));
        view.unmount();
        act(() => vi.advanceTimersByTime(60_000));
        expect(trackAnalyticsEvent).not.toHaveBeenCalled();
    });

    it('counts only the first deliberate map action until the map remounts', () => {
        function Map({ action }: { action: 'selection' | 'filter' }) {
            const interaction = useMapInteraction('flights');
            return <button onClick={() => interaction(action)}>Explore</button>;
        }
        const view = render(<StrictMode><Map action="selection" /></StrictMode>);
        expect(trackAnalyticsEvent).not.toHaveBeenCalled();
        act(() => view.getByRole('button').click());
        view.rerender(<StrictMode><Map action="filter" /></StrictMode>);
        act(() => view.getByRole('button').click());
        expect(trackAnalyticsEvent).toHaveBeenCalledExactlyOnceWith('map-interacted', { feature: 'flights', action: 'selection' });
        view.unmount();
        const next = render(<Map action="filter" />);
        act(() => next.getByRole('button').click());
        expect(trackAnalyticsEvent).toHaveBeenCalledTimes(2);
    });
});
