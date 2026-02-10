interface SelectedRouteIndicatorProps {
    route: string;
    onClear: () => void;
}

/**
 * Small chip indicator showing the currently selected route.
 */
export function SelectedRouteIndicator({ route, onClear }: SelectedRouteIndicatorProps) {
    return (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20">
            <button
                onClick={onClear}
                className="bg-gray-900/95 backdrop-blur px-3 py-1.5 rounded-full border border-yellow-500/50 text-sm flex items-center gap-2 shadow-lg hover:bg-gray-800/95 transition-colors"
                title="Click to clear selection (Esc)"
            >
                <span className="text-yellow-400 font-medium">
                    {route.replace('-', ' ↔ ')}
                </span>
                <span className="text-gray-500">✕</span>
            </button>
        </div>
    );
}
