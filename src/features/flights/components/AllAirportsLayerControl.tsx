import { useState, useRef, useEffect } from 'react';
import type { AirportSymbolMode, AllAirportsMetadata } from '../types';
import {
    AIRPORT_SYMBOL_MODE_LABELS,
    CONTINENT_COLORS,
    CONTINENT_LABELS,
    ELEVATION_COLORS,
    VISITED_COLOR,
    UNVISITED_COLOR,
} from '../constants';

interface AllAirportsLayerControlProps {
    visible: boolean;
    onVisibilityChange: (visible: boolean) => void;
    symbolMode: AirportSymbolMode;
    onSymbolModeChange: (mode: AirportSymbolMode) => void;
    metadata?: AllAirportsMetadata | null;
    loading?: boolean;
    showFlightPaths: boolean;
    onShowFlightPathsChange: (show: boolean) => void;
}

/**
 * Control panel for the all airports layer.
 * Allows toggling visibility and changing symbolization mode.
 */
export function AllAirportsLayerControl({
    visible,
    onVisibilityChange,
    symbolMode,
    onSymbolModeChange,
    metadata,
    loading = false,
    showFlightPaths,
    onShowFlightPathsChange,
}: AllAirportsLayerControlProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    // Close panel when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
                setIsExpanded(false);
            }
        }

        if (isExpanded) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isExpanded]);

    const symbolModes: AirportSymbolMode[] = ['visited', 'continent', 'country', 'elevation'];

    return (
        <div
            ref={panelRef}
            className="absolute top-16 right-4 z-30"
        >
            {/* Toggle Button */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${visible
                    ? 'bg-emerald-900/80 border-emerald-600/50 text-emerald-300'
                    : 'bg-gray-900/80 border-gray-700 text-gray-400 hover:text-gray-200'
                    } backdrop-blur`}
                aria-expanded={isExpanded}
                aria-label="Toggle all airports layer options"
            >
                {/* Globe icon */}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" strokeWidth={1.5} />
                    <path strokeLinecap="round" strokeWidth={1.5} d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                <span className="text-sm font-medium">
                    {loading ? 'Loading...' : 'All Airports'}
                </span>
                {metadata && visible && (
                    <span className="text-xs text-gray-500">
                        ({metadata.totalAirports.toLocaleString()})
                    </span>
                )}
                <svg
                    className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Expanded Panel */}
            {isExpanded && (
                <div className="absolute right-0 mt-2 w-72 bg-gray-900/95 backdrop-blur border border-gray-700 rounded-lg shadow-xl overflow-hidden">
                    {/* Layer Toggles */}
                    <div className="p-3 border-b border-gray-700 space-y-3">
                        {/* Show All Airports Toggle */}
                        <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-sm text-gray-300">Show All Airports</span>
                            <button
                                role="switch"
                                aria-checked={visible}
                                onClick={() => onVisibilityChange(!visible)}
                                className={`relative w-11 h-6 rounded-full transition-colors ${visible ? 'bg-emerald-600' : 'bg-gray-600'
                                    }`}
                            >
                                <span
                                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform ${visible ? 'translate-x-5' : ''
                                        }`}
                                />
                            </button>
                        </label>

                        {/* Show Flight Paths Toggle */}
                        <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-sm text-gray-300">Show Flight Paths</span>
                            <button
                                role="switch"
                                aria-checked={showFlightPaths}
                                onClick={() => onShowFlightPathsChange(!showFlightPaths)}
                                className={`relative w-11 h-6 rounded-full transition-colors ${showFlightPaths ? 'bg-purple-600' : 'bg-gray-600'
                                    }`}
                            >
                                <span
                                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform ${showFlightPaths ? 'translate-x-5' : ''
                                        }`}
                                />
                            </button>
                        </label>

                        {metadata && (
                            <div className="text-xs text-gray-500 flex gap-3">
                                <span>{metadata.totalAirports.toLocaleString()} airports</span>
                                <span className="text-emerald-400">{metadata.visitedCount} visited</span>
                            </div>
                        )}
                    </div>

                    {/* Symbolization Mode */}
                    {visible && (
                        <div className="p-3">
                            <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                                Symbolize By
                            </div>
                            <div className="grid grid-cols-2 gap-1">
                                {symbolModes.map((mode) => (
                                    <button
                                        key={mode}
                                        onClick={() => onSymbolModeChange(mode)}
                                        className={`px-3 py-2 text-xs rounded-md transition-colors ${symbolMode === mode
                                            ? 'bg-purple-600/50 text-purple-200 border border-purple-500/50'
                                            : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 hover:text-gray-300 border border-transparent'
                                            }`}
                                    >
                                        {AIRPORT_SYMBOL_MODE_LABELS[mode]}
                                    </button>
                                ))}
                            </div>

                            {/* Legend */}
                            <div className="mt-3 pt-3 border-t border-gray-700">
                                <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                                    Legend
                                </div>
                                {symbolMode === 'visited' && <VisitedLegend />}
                                {symbolMode === 'continent' && <ContinentLegend />}
                                {symbolMode === 'country' && <CountryLegend />}
                                {symbolMode === 'elevation' && <ElevationLegend />}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function VisitedLegend() {
    return (
        <div className="flex flex-col gap-1 text-xs">
            <div className="flex items-center gap-2">
                <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: VISITED_COLOR }}
                />
                <span className="text-gray-300">Visited airports</span>
            </div>
            <div className="flex items-center gap-2">
                <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: UNVISITED_COLOR }}
                />
                <span className="text-gray-400">Not yet visited</span>
            </div>
        </div>
    );
}

function ContinentLegend() {
    const continents = Object.entries(CONTINENT_LABELS);
    return (
        <div className="grid grid-cols-2 gap-1 text-xs">
            {continents.map(([code, name]) => (
                <div key={code} className="flex items-center gap-2">
                    <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: CONTINENT_COLORS[code] }}
                    />
                    <span className="text-gray-300 truncate">{name}</span>
                </div>
            ))}
        </div>
    );
}

function CountryLegend() {
    return (
        <div className="text-xs text-gray-400">
            Each country has a unique color based on its code. Hover over airports to see the country.
        </div>
    );
}

function ElevationLegend() {
    const items = [
        { label: `8,000+ ft`, color: ELEVATION_COLORS.VERY_HIGH },
        { label: `4,000-8,000 ft`, color: ELEVATION_COLORS.HIGH },
        { label: `1,000-4,000 ft`, color: ELEVATION_COLORS.MEDIUM },
        { label: `100-1,000 ft`, color: ELEVATION_COLORS.LOW },
        { label: `0-100 ft`, color: ELEVATION_COLORS.SEA_LEVEL },
    ];

    return (
        <div className="flex flex-col gap-1 text-xs">
            {items.map(({ label, color }) => (
                <div key={label} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-gray-300">{label}</span>
                </div>
            ))}
        </div>
    );
}
