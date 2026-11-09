import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { FilterPanel } from './FilterPanel';
import type { GlobePoint } from '../types';
import { FLIGHTS_UI_VISIBILITY } from '../constants';

interface TopNavigationBarProps {
    years: number[];
    selectedYear: number | null;
    onYearChange: (year: number | null) => void;
    flightCount: number;
    filterOpen?: boolean;
    onFilterOpenChange?: (isOpen: boolean) => void;
    airports: GlobePoint[];
    onAirportSelect: (code: string) => void;
    layerControls?: ReactNode;
}

/**
 * Top navigation bar with home link, title, and map controls.
 */
export function TopNavigationBar({
    years,
    selectedYear,
    onYearChange,
    flightCount,
    filterOpen,
    onFilterOpenChange,
    airports,
    onAirportSelect,
    layerControls,
}: TopNavigationBarProps) {
    return (
        <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between gap-2 px-4 py-3">
            {/* Left: Back button */}
            <div>
                {FLIGHTS_UI_VISIBILITY.homeLink && (
                    <Link
                        to="/"
                        className="bg-gray-900/90 backdrop-blur px-3 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-800/90 hover:text-white transition-colors flex items-center gap-2"
                    >
                        <span>←</span>
                        <span>rsmb.tv</span>
                    </Link>
                )}
            </div>

            {/* Center: Title (hidden on very small screens) */}
            <h1 className="sr-only md:not-sr-only text-white/80 text-sm font-medium">
                Flight History
            </h1>

            {/* Both popovers anchor to this toolbar, below its buttons. */}
            <div className="relative flex items-center gap-2">
                {FLIGHTS_UI_VISIBILITY.mapControls && layerControls}
                {FLIGHTS_UI_VISIBILITY.mapControls && years.length > 0 && (
                    <FilterPanel
                        years={years}
                        selectedYear={selectedYear}
                        onYearChange={onYearChange}
                        flightCount={flightCount}
                        isOpen={filterOpen}
                        onOpenChange={onFilterOpenChange}
                        airports={airports}
                        onAirportSelect={onAirportSelect}
                    />
                )}
            </div>
        </div>
    );
}
