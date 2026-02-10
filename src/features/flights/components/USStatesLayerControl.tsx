import { useState, useRef, useEffect } from 'react';
import type { StateSymbolMode, USStateStats } from '../types';
import {
    STATE_SYMBOL_MODE_LABELS,
    STATE_VISITED_COLOR,
    STATE_UNVISITED_COLOR,
    VISIT_COUNT_COLORS,
    FLIGHT_COUNT_COLORS,
} from '../constants';

interface USStatesLayerControlProps {
    visible: boolean;
    onVisibilityChange: (visible: boolean) => void;
    symbolMode: StateSymbolMode;
    onSymbolModeChange: (mode: StateSymbolMode) => void;
    stateStats: Map<string, USStateStats>;
    loading?: boolean;
}

/**
 * Control panel for the US states layer.
 * Allows toggling visibility and changing symbolization mode.
 */
export function USStatesLayerControl({
    visible,
    onVisibilityChange,
    symbolMode,
    onSymbolModeChange,
    stateStats,
    loading = false,
}: USStatesLayerControlProps) {
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

    // Calculate stats summary
    const visitedCount = Array.from(stateStats.values()).filter(s => s.visited).length;
    const totalStates = stateStats.size;

    const symbolModes: StateSymbolMode[] = ['visited', 'visitCount', 'flightCount'];

    return (
        <div
            ref={panelRef}
            className="absolute top-28 right-4 z-30"
        >
            {/* Toggle Button */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${visible
                    ? 'bg-blue-900/80 border-blue-600/50 text-blue-300'
                    : 'bg-gray-900/80 border-gray-700 text-gray-400 hover:text-gray-200'
                    } backdrop-blur`}
                aria-expanded={isExpanded}
                aria-label="Toggle US states layer options"
            >
                {/* Map icon */}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                <span className="text-sm font-medium">
                    {loading ? 'Loading...' : 'US States'}
                </span>
                {totalStates > 0 && visible && (
                    <span className="text-xs text-gray-500">
                        ({visitedCount}/{totalStates})
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
                    {/* Header */}
                    <div className="p-3 border-b border-gray-700">
                        <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-sm text-gray-300">Show US States</span>
                            <button
                                role="switch"
                                aria-checked={visible}
                                onClick={() => onVisibilityChange(!visible)}
                                className={`relative w-11 h-6 rounded-full transition-colors ${visible ? 'bg-blue-600' : 'bg-gray-600'
                                    }`}
                            >
                                <span
                                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform ${visible ? 'translate-x-5' : ''
                                        }`}
                                />
                            </button>
                        </label>

                        {totalStates > 0 && (
                            <div className="mt-2 text-xs text-gray-500 flex gap-3">
                                <span>{totalStates} states</span>
                                <span className="text-blue-400">{visitedCount} visited</span>
                                <span className="text-gray-500">{totalStates - visitedCount} remaining</span>
                            </div>
                        )}
                    </div>

                    {/* Symbolization Mode */}
                    {visible && (
                        <div className="p-3">
                            <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                                Symbolize By
                            </div>
                            <div className="flex flex-col gap-1">
                                {symbolModes.map((mode) => (
                                    <button
                                        key={mode}
                                        onClick={() => onSymbolModeChange(mode)}
                                        className={`px-3 py-2 text-xs rounded-md transition-colors text-left ${symbolMode === mode
                                            ? 'bg-blue-600/50 text-blue-200 border border-blue-500/50'
                                            : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 hover:text-gray-300 border border-transparent'
                                            }`}
                                    >
                                        {STATE_SYMBOL_MODE_LABELS[mode]}
                                    </button>
                                ))}
                            </div>

                            {/* Legend */}
                            <div className="mt-3 pt-3 border-t border-gray-700">
                                <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                                    Legend
                                </div>
                                {symbolMode === 'visited' && <VisitedStateLegend />}
                                {symbolMode === 'visitCount' && <VisitCountLegend />}
                                {symbolMode === 'flightCount' && <FlightCountLegend />}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function VisitedStateLegend() {
    return (
        <div className="flex flex-col gap-1 text-xs">
            <div className="flex items-center gap-2">
                <span
                    className="w-4 h-3 rounded-sm"
                    style={{ backgroundColor: STATE_VISITED_COLOR }}
                />
                <span className="text-gray-300">Visited (have flown to/from)</span>
            </div>
            <div className="flex items-center gap-2">
                <span
                    className="w-4 h-3 rounded-sm"
                    style={{ backgroundColor: STATE_UNVISITED_COLOR }}
                />
                <span className="text-gray-400">Not visited</span>
            </div>
        </div>
    );
}

function VisitCountLegend() {
    const items = [
        { label: '20+ airports', color: VISIT_COUNT_COLORS[6].color },
        { label: '11-20 airports', color: VISIT_COUNT_COLORS[5].color },
        { label: '6-10 airports', color: VISIT_COUNT_COLORS[4].color },
        { label: '4-5 airports', color: VISIT_COUNT_COLORS[3].color },
        { label: '2-3 airports', color: VISIT_COUNT_COLORS[2].color },
        { label: '1 airport', color: VISIT_COUNT_COLORS[1].color },
        { label: 'Not visited', color: VISIT_COUNT_COLORS[0].color },
    ];

    return (
        <div className="flex flex-col gap-1 text-xs">
            {items.map(({ label, color }) => (
                <div key={label} className="flex items-center gap-2">
                    <span className="w-4 h-3 rounded-sm" style={{ backgroundColor: color }} />
                    <span className="text-gray-300">{label}</span>
                </div>
            ))}
        </div>
    );
}

function FlightCountLegend() {
    const items = [
        { label: '50+ flights', color: FLIGHT_COUNT_COLORS[6].color },
        { label: '26-50 flights', color: FLIGHT_COUNT_COLORS[5].color },
        { label: '11-25 flights', color: FLIGHT_COUNT_COLORS[4].color },
        { label: '6-10 flights', color: FLIGHT_COUNT_COLORS[3].color },
        { label: '2-5 flights', color: FLIGHT_COUNT_COLORS[2].color },
        { label: '1 flight', color: FLIGHT_COUNT_COLORS[1].color },
        { label: 'No flights', color: FLIGHT_COUNT_COLORS[0].color },
    ];

    return (
        <div className="flex flex-col gap-1 text-xs">
            {items.map(({ label, color }) => (
                <div key={label} className="flex items-center gap-2">
                    <span className="w-4 h-3 rounded-sm" style={{ backgroundColor: color }} />
                    <span className="text-gray-300">{label}</span>
                </div>
            ))}
        </div>
    );
}
