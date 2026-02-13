import { memo } from 'react';

interface BottomStatsBarProps {
    totalFlights: number;
    totalAirports: number;
    totalDistance: number;
    selectedYear: number | null;
    selectedAirport: string | null;
    selectedAirline: string | null;
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
}: BottomStatsBarProps) {
    return (
        <div
            className="absolute bottom-4 left-4 right-20 sm:right-auto bg-gray-900/80 backdrop-blur px-3 sm:px-4 py-2 sm:py-3 rounded-lg border border-gray-700 text-xs sm:text-sm"
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
                <span className="text-gray-600 hidden sm:inline">•</span>
                <span className="hidden sm:inline">
                    <span className="text-green-300 font-semibold">{totalDistance.toLocaleString()}</span>
                    <span> km</span>
                </span>
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
                {selectedAirline && (
                    <>
                        <span className="text-gray-600 hidden sm:inline">•</span>
                        <span className="text-orange-400 font-semibold hidden sm:inline">{selectedAirline}</span>
                    </>
                )}
                {/* Help hint */}
                <span className="text-gray-600 hidden lg:inline">•</span>
                <span className="text-gray-500 hidden lg:inline text-xs">Press H for help</span>
            </div>
        </div>
    );
});
