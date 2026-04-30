import { useEffect, useRef, useCallback, useMemo } from 'react';

interface SwipeHandlers {
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    onSwipeUp?: () => void;
    onSwipeDown?: () => void;
}

interface SwipeOptions {
    threshold?: number;
    timeout?: number;
}

/**
 * Hook to detect swipe gestures on touch devices.
 * 
 * @param handlers - Callbacks for each swipe direction
 * @param options - Configuration options
 * @returns ref to attach to the target element
 */
export function useSwipeGesture<T extends HTMLElement = HTMLElement>(
    handlers: SwipeHandlers,
    options: SwipeOptions = {}
) {
    const { threshold = 50, timeout = 500 } = options;
    const elementRef = useRef<T>(null);
    const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

    const handleTouchStart = useCallback((e: TouchEvent) => {
        const touch = e.touches[0];
        touchStartRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            time: Date.now(),
        };
    }, []);

    const handleTouchEnd = useCallback((e: TouchEvent) => {
        if (!touchStartRef.current) return;

        const touch = e.changedTouches[0];
        const deltaX = touch.clientX - touchStartRef.current.x;
        const deltaY = touch.clientY - touchStartRef.current.y;
        const deltaTime = Date.now() - touchStartRef.current.time;

        // Ignore if too slow
        if (deltaTime > timeout) {
            touchStartRef.current = null;
            return;
        }

        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

        // Determine swipe direction
        if (absX > absY && absX > threshold) {
            // Horizontal swipe
            if (deltaX > 0) {
                handlers.onSwipeRight?.();
            } else {
                handlers.onSwipeLeft?.();
            }
        } else if (absY > absX && absY > threshold) {
            // Vertical swipe
            if (deltaY > 0) {
                handlers.onSwipeDown?.();
            } else {
                handlers.onSwipeUp?.();
            }
        }

        touchStartRef.current = null;
    }, [handlers, threshold, timeout]);

    useEffect(() => {
        const element = elementRef.current;
        if (!element) return;

        element.addEventListener('touchstart', handleTouchStart, { passive: true });
        element.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            element.removeEventListener('touchstart', handleTouchStart);
            element.removeEventListener('touchend', handleTouchEnd);
        };
    }, [handleTouchStart, handleTouchEnd]);

    return elementRef;
}

/**
 * Hook to handle swipe gestures for year navigation.
 */
export function useYearSwipeNavigation(
    years: number[],
    selectedYear: number | null,
    onYearChange: (year: number | null) => void
) {
    const sortedYears = useMemo(() => [...years].sort((a, b) => a - b), [years]);

    const handleSwipeLeft = useCallback(() => {
        // Swipe left = go to next year (or first year if none selected)
        if (selectedYear === null) {
            if (sortedYears.length > 0) {
                onYearChange(sortedYears[sortedYears.length - 1]);
            }
        } else {
            const currentIndex = sortedYears.indexOf(selectedYear);
            if (currentIndex < sortedYears.length - 1) {
                onYearChange(sortedYears[currentIndex + 1]);
            }
        }
    }, [selectedYear, sortedYears, onYearChange]);

    const handleSwipeRight = useCallback(() => {
        // Swipe right = go to previous year (or clear selection if at first year)
        if (selectedYear === null) {
            return;
        }
        const currentIndex = sortedYears.indexOf(selectedYear);
        if (currentIndex === 0) {
            onYearChange(null); // Clear selection
        } else if (currentIndex > 0) {
            onYearChange(sortedYears[currentIndex - 1]);
        }
    }, [selectedYear, sortedYears, onYearChange]);

    const handlers = useMemo(() => ({
        onSwipeLeft: handleSwipeLeft,
        onSwipeRight: handleSwipeRight,
    }), [handleSwipeLeft, handleSwipeRight]);

    return useSwipeGesture<HTMLDivElement>(handlers);
}
