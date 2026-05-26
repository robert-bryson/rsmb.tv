import { useState, useRef, useEffect, useCallback } from 'react';
import type { AirportSymbolMode, AllAirportsMetadata, BasemapId, ColorMode, LayerPanelSection, StateSymbolMode, USStateStats } from '../types';
import {
    AIRPORT_SYMBOL_MODE_LABELS,
    BASEMAPS,
    CONTINENT_COLORS,
    CONTINENT_LABELS,
    ELEVATION_COLORS,
    VISITED_COLOR,
    UNVISITED_COLOR,
    STATE_SYMBOL_MODE_LABELS,
    STATE_VISITED_COLOR,
    STATE_UNVISITED_COLOR,
    VISIT_COUNT_COLORS,
    FLIGHT_COUNT_COLORS,
    YEAR_COLORS,
    FREQUENCY_COLORS,
    FREQUENCY_THRESHOLDS,
} from '../constants';

interface LayersControlProps {
    // Basemap
    basemapId: BasemapId;
    onBasemapChange: (id: BasemapId) => void;

    // All Airports layer
    allAirportsVisible: boolean;
    onAllAirportsVisibilityChange: (visible: boolean) => void;
    airportSymbolMode: AirportSymbolMode;
    onAirportSymbolModeChange: (mode: AirportSymbolMode) => void;
    airportsMetadata?: AllAirportsMetadata | null;
    airportsLoading?: boolean;

    // Flight paths
    showFlightPaths: boolean;
    onShowFlightPathsChange: (show: boolean) => void;
    colorMode: ColorMode;
    onColorModeChange: (mode: ColorMode) => void;
    years: number[];

    // US States layer
    usStatesVisible: boolean;
    onUSStatesVisibilityChange: (visible: boolean) => void;
    stateSymbolMode: StateSymbolMode;
    onStateSymbolModeChange: (mode: StateSymbolMode) => void;
    stateStats: Map<string, USStateStats>;
    statesLoading?: boolean;

    isOpen?: boolean;
    onOpenChange?: (isOpen: boolean) => void;
    activeSection?: LayerPanelSection;
    onActiveSectionChange?: (section: LayerPanelSection) => void;
}

/**
 * Unified control panel for map layers (All Airports, US States, Flight Paths).
 */
export function LayersControl({
    basemapId,
    onBasemapChange,
    allAirportsVisible,
    onAllAirportsVisibilityChange,
    airportSymbolMode,
    onAirportSymbolModeChange,
    airportsMetadata,
    airportsLoading = false,
    showFlightPaths,
    onShowFlightPathsChange,
    colorMode,
    onColorModeChange,
    years,
    usStatesVisible,
    onUSStatesVisibilityChange,
    stateSymbolMode,
    onStateSymbolModeChange,
    stateStats,
    statesLoading = false,
    isOpen: controlledIsOpen,
    onOpenChange,
    activeSection: controlledActiveSection,
    onActiveSectionChange,
}: LayersControlProps) {
    const [internalIsExpanded, setInternalIsExpanded] = useState(false);
    const [internalActiveSection, setInternalActiveSection] = useState<LayerPanelSection>('none');
    const panelRef = useRef<HTMLDivElement>(null);
    const isExpanded = controlledIsOpen ?? internalIsExpanded;
    const activeSection = controlledActiveSection ?? internalActiveSection;

    const setPanelSection = useCallback((section: LayerPanelSection) => {
        onActiveSectionChange?.(section);
        if (controlledActiveSection === undefined) {
            setInternalActiveSection(section);
        }
    }, [controlledActiveSection, onActiveSectionChange]);

    const setPanelExpanded = useCallback((nextIsExpanded: boolean) => {
        onOpenChange?.(nextIsExpanded);
        if (controlledIsOpen === undefined) {
            setInternalIsExpanded(nextIsExpanded);
        }
        if (!nextIsExpanded) {
            setPanelSection('none');
        }
    }, [controlledIsOpen, onOpenChange, setPanelSection]);

    const togglePanelSection = useCallback((section: LayerPanelSection) => {
        setPanelSection(activeSection === section ? 'none' : section);
    }, [activeSection, setPanelSection]);

    // Close panel when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
                setPanelExpanded(false);
            }
        }

        if (isExpanded) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isExpanded, setPanelExpanded]);

    // Calculate stats
    const visitedStatesCount = Array.from(stateStats.values()).filter(s => s.visited).length;
    const totalStates = stateStats.size;

    // Count active layers
    const activeLayers = [allAirportsVisible, usStatesVisible, showFlightPaths].filter(Boolean).length;

    const airportSymbolModes: AirportSymbolMode[] = ['visited', 'continent', 'country', 'elevation'];
    const stateSymbolModes: StateSymbolMode[] = ['visited', 'visitCount', 'flightCount'];

    return (
        <div
            ref={panelRef}
            className="absolute top-16 right-4 z-30"
        >
            {/* Toggle Button */}
            <button
                onClick={() => setPanelExpanded(!isExpanded)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${activeLayers > 0
                    ? 'bg-purple-900/80 border-purple-600/50 text-purple-300'
                    : 'bg-gray-900/80 border-gray-700 text-gray-400 hover:text-gray-200'
                    } backdrop-blur`}
                aria-expanded={isExpanded}
                aria-label="Toggle layer options"
            >
                {/* Layers icon */}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7l9-4 9 4-9 4-9-4z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l9 4 9-4" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 17l9 4 9-4" />
                </svg>
                <span className="text-sm font-medium">Layers</span>
                {activeLayers > 0 && (
                    <span className="text-xs bg-purple-600/50 px-1.5 py-0.5 rounded">
                        {activeLayers}
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
                <div className="absolute right-0 mt-2 w-80 bg-gray-900/95 backdrop-blur border border-gray-700 rounded-lg shadow-xl overflow-hidden">
                    {/* Layer Toggles */}
                    <div className="p-3 space-y-2">
                        {/* Flight Paths with color mode config */}
                        <FlightPathsSection
                            showFlightPaths={showFlightPaths}
                            onShowFlightPathsChange={onShowFlightPathsChange}
                            colorMode={colorMode}
                            onColorModeChange={onColorModeChange}
                            years={years}
                            isExpanded={activeSection === 'flights'}
                            onToggleExpand={() => togglePanelSection('flights')}
                        />

                        {/* All Airports Toggle with expandable options */}
                        <LayerSection
                            label="All Airports"
                            icon={
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <circle cx="12" cy="12" r="10" strokeWidth={1.5} />
                                    <path strokeLinecap="round" strokeWidth={1.5} d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                                </svg>
                            }
                            checked={allAirportsVisible}
                            onChange={onAllAirportsVisibilityChange}
                            color="emerald"
                            loading={airportsLoading}
                            badge={airportsMetadata ? airportsMetadata.totalAirports.toLocaleString() : undefined}
                            isExpanded={activeSection === 'airports'}
                            onToggleExpand={() => togglePanelSection('airports')}
                        >
                            {/* Airport Symbol Modes */}
                            <div className="mt-2 pt-2 border-t border-gray-700/50">
                                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                                    Symbolize By
                                </div>
                                <div className="grid grid-cols-2 gap-1">
                                    {airportSymbolModes.map((mode) => (
                                        <button
                                            key={mode}
                                            onClick={() => onAirportSymbolModeChange(mode)}
                                            className={`px-2 py-1.5 text-xs rounded transition-colors ${airportSymbolMode === mode
                                                ? 'bg-emerald-600/50 text-emerald-200 border border-emerald-500/50'
                                                : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 hover:text-gray-300 border border-transparent'
                                                }`}
                                        >
                                            {AIRPORT_SYMBOL_MODE_LABELS[mode]}
                                        </button>
                                    ))}
                                </div>

                                {/* Legend */}
                                <div className="mt-2 pt-2 border-t border-gray-700/50">
                                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                                        Legend
                                    </div>
                                    {airportSymbolMode === 'visited' && <VisitedAirportLegend />}
                                    {airportSymbolMode === 'continent' && <ContinentLegend />}
                                    {airportSymbolMode === 'country' && <CountryLegend />}
                                    {airportSymbolMode === 'elevation' && <ElevationLegend />}
                                </div>
                            </div>
                        </LayerSection>

                        {/* US States Toggle with expandable options */}
                        <LayerSection
                            label="US States"
                            icon={
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                </svg>
                            }
                            checked={usStatesVisible}
                            onChange={onUSStatesVisibilityChange}
                            color="blue"
                            loading={statesLoading}
                            badge={totalStates > 0 ? `${visitedStatesCount}/${totalStates}` : undefined}
                            isExpanded={activeSection === 'states'}
                            onToggleExpand={() => togglePanelSection('states')}
                        >
                            {/* State Symbol Modes */}
                            <div className="mt-2 pt-2 border-t border-gray-700/50">
                                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                                    Symbolize By
                                </div>
                                <div className="flex flex-col gap-1">
                                    {stateSymbolModes.map((mode) => (
                                        <button
                                            key={mode}
                                            onClick={() => onStateSymbolModeChange(mode)}
                                            className={`px-2 py-1.5 text-xs rounded transition-colors text-left ${stateSymbolMode === mode
                                                ? 'bg-blue-600/50 text-blue-200 border border-blue-500/50'
                                                : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 hover:text-gray-300 border border-transparent'
                                                }`}
                                        >
                                            {STATE_SYMBOL_MODE_LABELS[mode]}
                                        </button>
                                    ))}
                                </div>

                                {/* Legend */}
                                <div className="mt-2 pt-2 border-t border-gray-700/50">
                                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                                        Legend
                                    </div>
                                    {stateSymbolMode === 'visited' && <VisitedStateLegend />}
                                    {stateSymbolMode === 'visitCount' && <VisitCountLegend />}
                                    {stateSymbolMode === 'flightCount' && <FlightCountLegend />}
                                </div>
                            </div>
                        </LayerSection>

                        {/* Basemap Selector */}
                        <BasemapSection
                            basemapId={basemapId}
                            onBasemapChange={onBasemapChange}
                            isExpanded={activeSection === 'basemap'}
                            onToggleExpand={() => togglePanelSection('basemap')}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

// Expandable layer section with sub-options
interface LayerSectionProps {
    label: string;
    icon: React.ReactNode;
    checked: boolean;
    onChange: (checked: boolean) => void;
    color: 'purple' | 'emerald' | 'blue';
    loading?: boolean;
    badge?: string;
    isExpanded: boolean;
    onToggleExpand: () => void;
    children: React.ReactNode;
}

function LayerSection({
    label,
    icon,
    checked,
    onChange,
    color,
    loading = false,
    badge,
    isExpanded,
    onToggleExpand,
    children,
}: LayerSectionProps) {
    const colorClasses = {
        purple: checked ? 'bg-purple-600' : 'bg-gray-600',
        emerald: checked ? 'bg-emerald-600' : 'bg-gray-600',
        blue: checked ? 'bg-blue-600' : 'bg-gray-600',
    };

    const borderClasses = {
        purple: checked ? 'border-purple-600/30' : 'border-transparent',
        emerald: checked ? 'border-emerald-600/30' : 'border-transparent',
        blue: checked ? 'border-blue-600/30' : 'border-transparent',
    };

    return (
        <div className={`rounded-lg bg-gray-800/30 border ${borderClasses[color]} transition-colors`}>
            <div className="flex items-center justify-between p-2">
                <button
                    onClick={onToggleExpand}
                    className="flex items-center gap-2 flex-1 text-left"
                    disabled={!checked}
                >
                    <span className={checked ? 'text-gray-200' : 'text-gray-500'}>{icon}</span>
                    <span className={`text-sm ${checked ? 'text-gray-200' : 'text-gray-400'}`}>
                        {loading ? 'Loading...' : label}
                    </span>
                    {badge && checked && (
                        <span className="text-xs text-gray-500">({badge})</span>
                    )}
                    {checked && (
                        <svg
                            className={`w-3 h-3 text-gray-500 transition-transform ml-auto mr-2 ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    )}
                </button>
                <button
                    role="switch"
                    aria-checked={checked}
                    onClick={() => onChange(!checked)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${colorClasses[color]}`}
                >
                    <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transform transition-transform ${checked ? 'translate-x-5' : ''
                            }`}
                    />
                </button>
            </div>

            {checked && isExpanded && (
                <div className="px-2 pb-2">
                    {children}
                </div>
            )}
        </div>
    );
}

// Legends
function VisitedAirportLegend() {
    return (
        <div className="flex gap-3 text-xs">
            <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: VISITED_COLOR }} />
                <span className="text-gray-400">Visited</span>
            </div>
            <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: UNVISITED_COLOR }} />
                <span className="text-gray-400">Not visited</span>
            </div>
        </div>
    );
}

function ContinentLegend() {
    const continents = Object.entries(CONTINENT_LABELS).slice(0, 6); // Exclude Antarctica
    return (
        <div className="grid grid-cols-3 gap-x-2 gap-y-0.5 text-xs">
            {continents.map(([code, name]) => (
                <div key={code} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CONTINENT_COLORS[code] }} />
                    <span className="text-gray-400 truncate text-[10px]">{name}</span>
                </div>
            ))}
        </div>
    );
}

function CountryLegend() {
    return (
        <div className="text-xs text-gray-500">
            Colors vary by country code
        </div>
    );
}

function ElevationLegend() {
    return (
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
            <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ELEVATION_COLORS.VERY_HIGH }} />
                <span className="text-gray-400 text-[10px]">8k+</span>
            </span>
            <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ELEVATION_COLORS.HIGH }} />
                <span className="text-gray-400 text-[10px]">4-8k</span>
            </span>
            <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ELEVATION_COLORS.MEDIUM }} />
                <span className="text-gray-400 text-[10px]">1-4k</span>
            </span>
            <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ELEVATION_COLORS.LOW }} />
                <span className="text-gray-400 text-[10px]">100-1k</span>
            </span>
            <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ELEVATION_COLORS.SEA_LEVEL }} />
                <span className="text-gray-400 text-[10px]">0-100</span>
            </span>
        </div>
    );
}

function VisitedStateLegend() {
    return (
        <div className="flex gap-3 text-xs">
            <div className="flex items-center gap-1.5">
                <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: STATE_VISITED_COLOR }} />
                <span className="text-gray-400">Visited</span>
            </div>
            <div className="flex items-center gap-1.5">
                <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: STATE_UNVISITED_COLOR }} />
                <span className="text-gray-400">Not visited</span>
            </div>
        </div>
    );
}

function VisitCountLegend() {
    return (
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
            <span className="flex items-center gap-1">
                <span className="w-2.5 h-2 rounded-sm" style={{ backgroundColor: VISIT_COUNT_COLORS[6].color }} />
                <span className="text-gray-400 text-[10px]">20+</span>
            </span>
            <span className="flex items-center gap-1">
                <span className="w-2.5 h-2 rounded-sm" style={{ backgroundColor: VISIT_COUNT_COLORS[4].color }} />
                <span className="text-gray-400 text-[10px]">6-10</span>
            </span>
            <span className="flex items-center gap-1">
                <span className="w-2.5 h-2 rounded-sm" style={{ backgroundColor: VISIT_COUNT_COLORS[2].color }} />
                <span className="text-gray-400 text-[10px]">2-3</span>
            </span>
            <span className="flex items-center gap-1">
                <span className="w-2.5 h-2 rounded-sm" style={{ backgroundColor: VISIT_COUNT_COLORS[0].color }} />
                <span className="text-gray-400 text-[10px]">0</span>
            </span>
        </div>
    );
}

function FlightCountLegend() {
    return (
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
            <span className="flex items-center gap-1">
                <span className="w-2.5 h-2 rounded-sm" style={{ backgroundColor: FLIGHT_COUNT_COLORS[6].color }} />
                <span className="text-gray-400 text-[10px]">50+</span>
            </span>
            <span className="flex items-center gap-1">
                <span className="w-2.5 h-2 rounded-sm" style={{ backgroundColor: FLIGHT_COUNT_COLORS[4].color }} />
                <span className="text-gray-400 text-[10px]">11-25</span>
            </span>
            <span className="flex items-center gap-1">
                <span className="w-2.5 h-2 rounded-sm" style={{ backgroundColor: FLIGHT_COUNT_COLORS[2].color }} />
                <span className="text-gray-400 text-[10px]">2-5</span>
            </span>
            <span className="flex items-center gap-1">
                <span className="w-2.5 h-2 rounded-sm" style={{ backgroundColor: FLIGHT_COUNT_COLORS[0].color }} />
                <span className="text-gray-400 text-[10px]">0</span>
            </span>
        </div>
    );
}

// Flight paths section with color mode config
interface FlightPathsSectionProps {
    showFlightPaths: boolean;
    onShowFlightPathsChange: (show: boolean) => void;
    colorMode: ColorMode;
    onColorModeChange: (mode: ColorMode) => void;
    years: number[];
    isExpanded: boolean;
    onToggleExpand: () => void;
}

const COLOR_MODE_OPTIONS: { value: ColorMode; label: string }[] = [
    { value: 'default', label: 'Default' },
    { value: 'year', label: 'By Year' },
    { value: 'frequency', label: 'By Frequency' },
    { value: 'airline', label: 'By Airline' },
];

function FlightPathsSection({
    showFlightPaths,
    onShowFlightPathsChange,
    colorMode,
    onColorModeChange,
    years,
    isExpanded,
    onToggleExpand,
}: FlightPathsSectionProps) {
    const sortedYears = [...years].sort((a, b) => a - b);

    return (
        <div className={`rounded-lg bg-gray-800/30 border ${showFlightPaths ? 'border-purple-600/30' : 'border-transparent'} transition-colors`}>
            <div className="flex items-center justify-between p-2">
                <button
                    onClick={onToggleExpand}
                    className="flex items-center gap-2 flex-1 text-left"
                    disabled={!showFlightPaths}
                >
                    <span className={showFlightPaths ? 'text-gray-200' : 'text-gray-500'}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 18.657A8 8 0 016.343 7.343M3 12h1m16 0h1M12 3v1m0 16v1m-8.485-8.485l.707.707m12.728 0l.707-.707m-12.728-12.728l.707.707" />
                        </svg>
                    </span>
                    <span className={`text-sm ${showFlightPaths ? 'text-gray-200' : 'text-gray-400'}`}>
                        Flight Paths
                    </span>
                    {showFlightPaths && (
                        <svg
                            className={`w-3 h-3 text-gray-500 transition-transform ml-auto mr-2 ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    )}
                </button>
                <button
                    role="switch"
                    aria-checked={showFlightPaths}
                    onClick={() => onShowFlightPathsChange(!showFlightPaths)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${showFlightPaths ? 'bg-purple-600' : 'bg-gray-600'}`}
                >
                    <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transform transition-transform ${showFlightPaths ? 'translate-x-5' : ''}`}
                    />
                </button>
            </div>

            {showFlightPaths && isExpanded && (
                <div className="px-2 pb-2">
                    <div className="mt-2 pt-2 border-t border-gray-700/50">
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                            Color By
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                            {COLOR_MODE_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => onColorModeChange(opt.value)}
                                    className={`px-2 py-1.5 text-xs rounded transition-colors ${colorMode === opt.value
                                        ? 'bg-purple-600/50 text-purple-200 border border-purple-500/50'
                                        : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 hover:text-gray-300 border border-transparent'
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>

                        {/* Legend */}
                        <div className="mt-2 pt-2 border-t border-gray-700/50">
                            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                                Legend
                            </div>
                            {colorMode === 'year' && sortedYears.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                    {sortedYears.map((year) => (
                                        <div key={year} className="flex items-center gap-1 text-xs">
                                            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: YEAR_COLORS[year] || '#a855f7' }} />
                                            <span className="text-gray-400">{year}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {colorMode === 'frequency' && (
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-1.5 text-xs">
                                        <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: FREQUENCY_COLORS.VERY_FREQUENT }} />
                                        <span className="text-gray-400">Very frequent ({Math.round(FREQUENCY_THRESHOLDS.VERY_FREQUENT * 100)}%+)</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs">
                                        <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: FREQUENCY_COLORS.FREQUENT }} />
                                        <span className="text-gray-400">Frequent</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs">
                                        <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: FREQUENCY_COLORS.MODERATE }} />
                                        <span className="text-gray-400">Moderate</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs">
                                        <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: FREQUENCY_COLORS.OCCASIONAL }} />
                                        <span className="text-gray-400">Occasional</span>
                                    </div>
                                </div>
                            )}
                            {colorMode === 'airline' && (
                                <div className="text-xs text-gray-500">Colors vary by airline</div>
                            )}
                            {colorMode === 'default' && (
                                <div className="text-xs text-gray-500">Default purple palette</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Basemap selector section
interface BasemapSectionProps {
    basemapId: BasemapId;
    onBasemapChange: (id: BasemapId) => void;
    isExpanded: boolean;
    onToggleExpand: () => void;
}

function BasemapSection({ basemapId, onBasemapChange, isExpanded, onToggleExpand }: BasemapSectionProps) {
    const currentLabel = BASEMAPS.find(b => b.id === basemapId)?.label ?? 'Night';

    return (
        <div className="rounded-lg bg-gray-800/30 border border-transparent transition-colors">
            <button
                onClick={onToggleExpand}
                className="flex items-center justify-between w-full p-2 text-left"
            >
                <div className="flex items-center gap-2">
                    <span className="text-gray-200">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </span>
                    <span className="text-sm text-gray-200">Basemap</span>
                    <span className="text-xs text-gray-500">({currentLabel})</span>
                </div>
                <svg
                    className={`w-3 h-3 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isExpanded && (
                <div className="px-2 pb-2">
                    <div className="grid grid-cols-2 gap-1">
                        {BASEMAPS.map((basemap) => (
                            <button
                                key={basemap.id}
                                onClick={() => onBasemapChange(basemap.id as BasemapId)}
                                className={`px-2 py-1.5 text-xs rounded transition-colors ${basemapId === basemap.id
                                    ? 'bg-indigo-600/50 text-indigo-200 border border-indigo-500/50'
                                    : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 hover:text-gray-300 border border-transparent'
                                    }`}
                            >
                                {basemap.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
