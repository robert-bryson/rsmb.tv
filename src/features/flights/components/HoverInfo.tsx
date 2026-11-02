import { memo } from 'react';
import type { GlobeStaticArc, GlobePoint } from '../types';
import { flightDurationLabel, formatFlightHours, summarizeFlightDurations } from '../utils/flightDuration';

interface HoverInfoProps {
    hoveredArc: GlobeStaticArc | null;
    hoveredPoint: GlobePoint | null;
}

/**
 * Hover information tooltip displayed in the bottom right.
 * Hidden on small screens.
 */
export const HoverInfo = memo(function HoverInfo({ hoveredArc, hoveredPoint }: HoverInfoProps) {
    if (!hoveredArc && !hoveredPoint) return null;
    const duration = hoveredArc ? summarizeFlightDurations(hoveredArc.flights) : null;

    return (
        <div
            className="hidden sm:block absolute bottom-20 left-4 bg-gray-900/80 backdrop-blur px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 max-w-xs"
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
                    {duration && <div className="text-xs text-gray-400">{flightDurationLabel(duration)}: {formatFlightHours(duration)}</div>}
                </div>
            )}
            {hoveredPoint && (
                <span>{hoveredPoint.airport.code}: {hoveredPoint.airport.name}</span>
            )}
        </div>
    );
});
