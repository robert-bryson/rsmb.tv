import { useState, useMemo, type ReactNode } from 'react';

interface VirtualizedListProps<T> {
    items: T[];
    renderItem: (item: T, index: number) => ReactNode;
    initialCount?: number;
    incrementCount?: number;
    keyExtractor: (item: T, index: number) => string;
    emptyMessage?: string;
}

/**
 * A simple virtualized list that shows items incrementally.
 * Not true virtualization (which requires fixed heights), but a progressive
 * loading approach that limits initial render and allows "show more".
 */
export function VirtualizedList<T>({
    items,
    renderItem,
    initialCount = 10,
    incrementCount = 10,
    keyExtractor,
    emptyMessage = 'No items',
}: VirtualizedListProps<T>) {
    const [displayCount, setDisplayCount] = useState(initialCount);

    const visibleItems = useMemo(() => {
        return items.slice(0, displayCount);
    }, [items, displayCount]);

    const hasMore = displayCount < items.length;
    const remainingCount = items.length - displayCount;

    const handleShowMore = () => {
        setDisplayCount((prev) => Math.min(prev + incrementCount, items.length));
    };

    const handleShowAll = () => {
        setDisplayCount(items.length);
    };

    if (items.length === 0) {
        return <div className="text-gray-500 text-xs text-center py-2">{emptyMessage}</div>;
    }

    return (
        <div>
            <div className="space-y-1">
                {visibleItems.map((item, index) => (
                    <div key={keyExtractor(item, index)}>{renderItem(item, index)}</div>
                ))}
            </div>

            {hasMore && (
                <div className="mt-2 pt-2 border-t border-gray-800 flex items-center justify-between">
                    <span className="text-gray-500 text-xs">{remainingCount} more</span>
                    <div className="flex gap-2">
                        <button
                            onClick={handleShowMore}
                            className="text-purple-400 hover:text-purple-300 text-xs transition-colors"
                        >
                            Show {Math.min(incrementCount, remainingCount)} more
                        </button>
                        {remainingCount > incrementCount && (
                            <button
                                onClick={handleShowAll}
                                className="text-gray-500 hover:text-gray-400 text-xs transition-colors"
                            >
                                Show all
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
