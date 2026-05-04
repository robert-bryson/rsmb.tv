import { memo } from 'react';
import { formatDistance } from '../utils';

interface BottomStatsBarProps {
    totalFlights: number;
    totalAirports: number;
    totalDistance: number;
    selectedYear: number | null;
    selectedAirport: string | null;
    selectedAirline: string | null;
    selectedCountry: string | null;
    selectedRegion: string | null;
    isMetric: boolean;
    onToggleUnits: () => void;
}

/**
 * Bottom status bar showing summary statistics.
 */
export const BottomStatsBar = memo(function BottomStatsBar({
    totalFlights,
    totalAirports,
    totalDistance,
    selectedYear,
    selectedAirport,
    selectedAirline,
    selectedCountry,
    selectedRegion,
    isMetric,
    onToggleUnits,
}: BottomStatsBarProps) {
    return (
        <div
            className="absolute bottom-4 left-4 right-16 sm:right-auto bg-gray-900/80 backdrop-blur px-3 sm:px-4 py-2 sm:py-3 rounded-lg border border-gray-700 text-xs sm:text-sm pb-[env(safe-area-inset-bottom,0.5rem)]"
            role="status"
            aria-live="polite"
        >
            <div className="text-gray-400 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>
                    <span className="text-purple-300 font-semibold">{totalFlights}</span>
                    <span className="hidden sm:inline"> flights</span>
                    <span className="sm:hidden">✈</span>
                </span>
                <span className="text-gray-600">•</span>
                <span>
                    <span className="text-yellow-300 font-semibold">{totalAirports}</span>
                    <span className="hidden sm:inline"> airports</span>
                    <span className="sm:hidden">📍</span>
                </span>
                <span className="text-gray-600">•</span>
                <button
                    type="button"
                    onClick={onToggleUnits}
                    className="text-green-300 font-semibold hover:text-green-200 transition-colors cursor-pointer whitespace-nowrap rounded px-1 -mx-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-300"
                    title={isMetric ? 'Switch to imperial (mi/ft)' : 'Switch to metric (km/m)'}
                    aria-label={isMetric ? 'Switch to imperial units' : 'Switch to metric units'}
                >
                    {formatDistance(totalDistance, isMetric)}
                </button>
                {selectedYear && (
                    <>
                        <span className="text-gray-600">•</span>
                        <span className="text-white font-semibold">{selectedYear}</span>
                    </>
                )}
                {selectedAirport && (
                    <>
                        <span className="text-gray-600">•</span>
                        <span className="text-cyan-400 font-semibold">{selectedAirport}</span>
                    </>
                )}
                {selectedCountry && (
                    <>
                        <span className="text-gray-600">•</span>
                        <span className="text-emerald-400 font-semibold">{selectedCountry}</span>
                    </>
                )}
                {selectedRegion && (
                    <>
                        <span className="text-gray-600">•</span>
                        <span className="text-amber-400 font-semibold">{selectedRegion}</span>
                    </>
                )}
                {selectedAirline && (
                    <>
                        <span className="text-gray-600 hidden sm:inline">•</span>
                        <span className="text-orange-400 font-semibold hidden sm:inline">{selectedAirline}</span>
                    </>
                )}
            </div>
        </div>
    );
});
