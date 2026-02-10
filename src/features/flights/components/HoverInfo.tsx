import type { GlobeStaticArc, GlobePoint } from '../types';

interface HoverInfoProps {
    hoveredArc: GlobeStaticArc | null;
    hoveredPoint: GlobePoint | null;
}

/**
 * Hover information tooltip displayed in the bottom right.
 * Hidden on small screens.
 */
export function HoverInfo({ hoveredArc, hoveredPoint }: HoverInfoProps) {
    if (!hoveredArc && !hoveredPoint) return null;

    return (
        <div
            className="hidden sm:block absolute bottom-16 right-4 bg-gray-900/80 backdrop-blur px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 max-w-xs"
            role="tooltip"
        >
            {hoveredArc && (
                <div>
                    <span className="text-purple-300">
                        {hoveredArc.flights[0]?.origin_code} ↔ {hoveredArc.flights[0]?.destination_code}
                    </span>
                    {hoveredArc.routeCount > 1 && (
                        <span className="text-gray-500 ml-2">({hoveredArc.routeCount} flights)</span>
                    )}
                </div>
            )}
            {hoveredPoint && (
                <span>{hoveredPoint.airport.code}: {hoveredPoint.airport.name}</span>
            )}
        </div>
    );
}
