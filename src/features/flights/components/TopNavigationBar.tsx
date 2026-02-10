import { Link } from 'react-router-dom';
import { FilterPanel } from './FilterPanel';
import type { GlobePoint } from '../types';

interface TopNavigationBarProps {
    years: number[];
    selectedYear: number | null;
    onYearChange: (year: number | null) => void;
    flightCount: number;
    airports: GlobePoint[];
    onAirportSelect: (code: string) => void;
}

/**
 * Top navigation bar with back button, title, and filter panel.
 */
export function TopNavigationBar({
    years,
    selectedYear,
    onYearChange,
    flightCount,
    airports,
    onAirportSelect,
}: TopNavigationBarProps) {
    return (
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3">
            {/* Left: Back button */}
            <Link
                to="/projects"
                className="bg-gray-900/90 backdrop-blur px-3 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-800/90 hover:text-white transition-colors flex items-center gap-2"
            >
                <span>←</span>
                <span className="hidden sm:inline">Back</span>
            </Link>

            {/* Center: Title (hidden on very small screens) */}
            <h1 className="hidden md:block text-white/80 text-sm font-medium">
                Flight History
            </h1>

            {/* Right: Filter */}
            {years.length > 0 ? (
                <FilterPanel
                    years={years}
                    selectedYear={selectedYear}
                    onYearChange={onYearChange}
                    flightCount={flightCount}
                    airports={airports}
                    onAirportSelect={onAirportSelect}
                />
            ) : (
                <div />
            )}
        </div>
    );
}
