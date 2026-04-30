import { describe, it, expect, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import React from 'react';
import { useSwipeGesture, useYearSwipeNavigation } from '../features/flights/hooks/useSwipeGesture';

// Helper to fire a TouchEvent on an element
function fireTouchStart(el: HTMLElement, x: number, y: number) {
    el.dispatchEvent(
        new TouchEvent('touchstart', {
            bubbles: true,
            touches: [{ clientX: x, clientY: y } as Touch],
        })
    );
}

function fireTouchEnd(el: HTMLElement, x: number, y: number) {
    el.dispatchEvent(
        new TouchEvent('touchend', {
            bubbles: true,
            changedTouches: [{ clientX: x, clientY: y } as Touch],
        })
    );
}

/**
 * Test wrapper that renders the hook and attaches the returned ref to a <div>.
 * This ensures the useEffect inside useSwipeGesture sees the element on mount.
 */
function SwipeTarget({
    handlers,
    options,
}: {
    handlers: Parameters<typeof useSwipeGesture>[0];
    options?: Parameters<typeof useSwipeGesture>[1];
}) {
    const ref = useSwipeGesture(handlers, options);
    return React.createElement('div', { ref, 'data-testid': 'target' });
}

function YearSwipeTarget({
    years,
    selectedYear,
    onYearChange,
}: {
    years: number[];
    selectedYear: number | null;
    onYearChange: (year: number | null) => void;
}) {
    const ref = useYearSwipeNavigation(years, selectedYear, onYearChange);
    return React.createElement('div', { ref, 'data-testid': 'target' });
}

describe('useSwipeGesture', () => {
    it('calls onSwipeLeft for a left swipe', () => {
        const handlers = { onSwipeLeft: vi.fn(), onSwipeRight: vi.fn() };
        const { getByTestId } = render(React.createElement(SwipeTarget, { handlers, options: { threshold: 30 } }));
        const el = getByTestId('target');

        act(() => {
            fireTouchStart(el, 200, 100);
            fireTouchEnd(el, 100, 100); // moved -100px in X (left)
        });

        expect(handlers.onSwipeLeft).toHaveBeenCalledOnce();
        expect(handlers.onSwipeRight).not.toHaveBeenCalled();
    });

    it('calls onSwipeRight for a right swipe', () => {
        const handlers = { onSwipeLeft: vi.fn(), onSwipeRight: vi.fn() };
        const { getByTestId } = render(React.createElement(SwipeTarget, { handlers, options: { threshold: 30 } }));
        const el = getByTestId('target');

        act(() => {
            fireTouchStart(el, 100, 100);
            fireTouchEnd(el, 200, 100); // moved +100px in X (right)
        });

        expect(handlers.onSwipeRight).toHaveBeenCalledOnce();
    });

    it('calls onSwipeUp for an upward swipe', () => {
        const handlers = { onSwipeUp: vi.fn(), onSwipeDown: vi.fn() };
        const { getByTestId } = render(React.createElement(SwipeTarget, { handlers, options: { threshold: 30 } }));
        const el = getByTestId('target');

        act(() => {
            fireTouchStart(el, 100, 200);
            fireTouchEnd(el, 100, 100); // moved -100px in Y (up)
        });

        expect(handlers.onSwipeUp).toHaveBeenCalledOnce();
    });

    it('calls onSwipeDown for a downward swipe', () => {
        const handlers = { onSwipeUp: vi.fn(), onSwipeDown: vi.fn() };
        const { getByTestId } = render(React.createElement(SwipeTarget, { handlers, options: { threshold: 30 } }));
        const el = getByTestId('target');

        act(() => {
            fireTouchStart(el, 100, 100);
            fireTouchEnd(el, 100, 200); // moved +100px in Y (down)
        });

        expect(handlers.onSwipeDown).toHaveBeenCalledOnce();
    });

    it('ignores swipes below threshold', () => {
        const handlers = { onSwipeLeft: vi.fn(), onSwipeRight: vi.fn() };
        const { getByTestId } = render(React.createElement(SwipeTarget, { handlers, options: { threshold: 100 } }));
        const el = getByTestId('target');

        act(() => {
            fireTouchStart(el, 100, 100);
            fireTouchEnd(el, 150, 100); // only +50px; below threshold of 100
        });

        expect(handlers.onSwipeLeft).not.toHaveBeenCalled();
        expect(handlers.onSwipeRight).not.toHaveBeenCalled();
    });

    it('ignores swipes that exceed the timeout', () => {
        const handlers = { onSwipeLeft: vi.fn() };
        const { getByTestId } = render(React.createElement(SwipeTarget, { handlers, options: { threshold: 30, timeout: 100 } }));
        const el = getByTestId('target');

        const dateNow = vi.spyOn(Date, 'now');
        let fakeNow = 0;
        dateNow.mockImplementation(() => fakeNow);

        try {
            act(() => {
                fakeNow = 0;
                fireTouchStart(el, 200, 100);
                fakeNow = 200; // 200ms elapsed; exceeds timeout of 100ms
                fireTouchEnd(el, 50, 100);
            });
        } finally {
            dateNow.mockRestore();
        }

        expect(handlers.onSwipeLeft).not.toHaveBeenCalled();
    });

    it('does not fire if touchStart was never called', () => {
        const handlers = { onSwipeLeft: vi.fn() };
        const { getByTestId } = render(React.createElement(SwipeTarget, { handlers, options: { threshold: 30 } }));
        const el = getByTestId('target');

        act(() => {
            fireTouchEnd(el, 50, 100); // touchEnd without a prior touchStart
        });

        expect(handlers.onSwipeLeft).not.toHaveBeenCalled();
    });
});
describe('useYearSwipeNavigation', () => {
    const years = [2020, 2021, 2022, 2023, 2024];

    it('swipe left advances to the next year', () => {
        const onYearChange = vi.fn();
        const { getByTestId } = render(
            React.createElement(YearSwipeTarget, { years, selectedYear: 2022, onYearChange })
        );
        const el = getByTestId('target');

        act(() => {
            fireTouchStart(el, 200, 100);
            fireTouchEnd(el, 100, 100); // left swipe advances to next year
        });

        expect(onYearChange).toHaveBeenCalledWith(2023);
    });

    it('swipe right goes back to the previous year', () => {
        const onYearChange = vi.fn();
        const { getByTestId } = render(
            React.createElement(YearSwipeTarget, { years, selectedYear: 2022, onYearChange })
        );
        const el = getByTestId('target');

        act(() => {
            fireTouchStart(el, 100, 100);
            fireTouchEnd(el, 200, 100); // right swipe goes to previous year
        });

        expect(onYearChange).toHaveBeenCalledWith(2021);
    });

    it('swipe right at first year clears the filter (null)', () => {
        const onYearChange = vi.fn();
        const { getByTestId } = render(
            React.createElement(YearSwipeTarget, { years, selectedYear: 2020, onYearChange })
        );
        const el = getByTestId('target');

        act(() => {
            fireTouchStart(el, 100, 100);
            fireTouchEnd(el, 200, 100); // right swipe at first year clears to null
        });

        expect(onYearChange).toHaveBeenCalledWith(null);
    });

    it('swipe right when no year selected does nothing', () => {
        const onYearChange = vi.fn();
        const { getByTestId } = render(
            React.createElement(YearSwipeTarget, { years, selectedYear: null, onYearChange })
        );
        const el = getByTestId('target');

        act(() => {
            fireTouchStart(el, 100, 100);
            fireTouchEnd(el, 200, 100); // right swipe when null is a no-op
        });

        expect(onYearChange).not.toHaveBeenCalled();
    });

    it('swipe left when no year selected picks the last year', () => {
        const onYearChange = vi.fn();
        const { getByTestId } = render(
            React.createElement(YearSwipeTarget, { years, selectedYear: null, onYearChange })
        );
        const el = getByTestId('target');

        act(() => {
            fireTouchStart(el, 200, 100);
            fireTouchEnd(el, 100, 100); // left swipe when null picks last year
        });

        expect(onYearChange).toHaveBeenCalledWith(2024);
    });

    it('does nothing with an empty years array', () => {
        const onYearChange = vi.fn();
        const { getByTestId } = render(
            React.createElement(YearSwipeTarget, { years: [], selectedYear: null, onYearChange })
        );
        const el = getByTestId('target');

        act(() => {
            fireTouchStart(el, 200, 100);
            fireTouchEnd(el, 100, 100);
        });

        expect(onYearChange).not.toHaveBeenCalled();
    });
});
