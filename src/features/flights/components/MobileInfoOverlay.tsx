import { memo } from 'react';
import type { GlobeStaticArc } from '../types';

interface MobileInfoOverlayProps {
    arc: GlobeStaticArc | null;
    onClose: () => void;
    onSelect: (arc: GlobeStaticArc) => void;
}

/**
 * Mobile-specific info overlay for route details.
 * Shown when tapping on a route on touch devices.
 */
export const MobileInfoOverlay = memo(function MobileInfoOverlay({ arc, onClose, onSelect }: MobileInfoOverlayProps) {
    if (!arc) return null;

    const firstFlight = arc.flights[0];

    if (!firstFlight) return null;

    return (
        <div
            className="sm:hidden fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] z-30"
            role="dialog"
            aria-label="Route information"
        >
            <div className="bg-gray-900/95 backdrop-blur rounded-lg border border-gray-700 p-4 shadow-xl">
                <div className="flex justify-between items-start mb-3">
                    <div>
                        <div className="text-purple-300 font-bold text-lg">
                            {firstFlight.origin_code} ↔ {firstFlight.destination_code}
                        </div>
                        <div className="text-gray-400 text-sm">
                            {arc.routeCount} flight{arc.routeCount !== 1 ? 's' : ''}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-white p-1"
                        aria-label="Close route information"
                    >
                        ✕
                    </button>
                </div>
                <div className="text-gray-300 text-sm space-y-1">
                    <div>{firstFlight.origin_name}</div>
                    <div className="text-gray-500">↕</div>
                    <div>{firstFlight.destination_name}</div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-700 text-xs text-gray-500">
                    Dates: {arc.flights.slice(0, 3).map(f => f.date).join(', ')}
                    {arc.flights.length > 3 && '...'}
                </div>
                <button
                    onClick={() => onSelect(arc)}
                    className="mt-3 w-full bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 py-2 rounded-lg text-sm transition-colors"
                >
                    Select this route
                </button>
            </div>
        </div>
    );
});
