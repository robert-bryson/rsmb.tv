import { useState, useMemo, useRef, useEffect } from 'react';
import type { GlobePoint } from '../types';

interface FilterPanelProps {
  years: number[];
  selectedYear: number | null;
  onYearChange: (year: number | null) => void;
  flightCount: number;
  // Airport search
  airports: GlobePoint[];
  onAirportSelect: (code: string) => void;
}

export function FilterPanel({
  years,
  selectedYear,
  onYearChange,
  flightCount,
  airports,
  onAirportSelect,
}: FilterPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ year: true });
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Group years by decade for better organization
  const yearsByDecade = years.reduce(
    (acc, year) => {
      const decade = Math.floor(year / 10) * 10;
      if (!acc[decade]) acc[decade] = [];
      acc[decade].push(year);
      return acc;
    },
    {} as Record<number, number[]>
  );

  const decades = Object.keys(yearsByDecade)
    .map(Number)
    .sort((a, b) => b - a);
  const hasActiveFilters = selectedYear !== null;

  // Airport search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return airports
      .filter(
        (p) =>
          p.airport.code.toLowerCase().includes(query) ||
          p.airport.name.toLowerCase().includes(query) ||
          p.airport.municipality?.toLowerCase().includes(query)
      )
      .slice(0, 8);
  }, [searchQuery, airports]);

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchInputRef.current && !searchInputRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative">
      {/* Filter Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`bg-gray-900/90 backdrop-blur px-3 py-2 rounded-lg border text-sm transition-all flex items-center gap-2 ${
          hasActiveFilters
            ? 'border-purple-500 text-purple-300'
            : 'border-gray-700 text-gray-300 hover:bg-gray-800/90'
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
          />
        </svg>
        {hasActiveFilters && (
          <span className="bg-purple-600 text-white text-xs px-1.5 py-0.5 rounded-full">1</span>
        )}
      </button>

      {/* Filter Panel */}
      {isOpen && (
        <div className="absolute top-12 right-0 w-72 bg-gray-900/95 backdrop-blur rounded-lg border border-gray-700 shadow-xl overflow-hidden z-30">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
            <h3 className="text-white font-medium text-sm">Filters</h3>
            {hasActiveFilters && (
              <button
                onClick={() => onYearChange(null)}
                className="text-xs text-gray-400 hover:text-white transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Filter Sections */}
          <div className="max-h-[60vh] overflow-y-auto">
            {/* Airport Search Section */}
            <div className="border-b border-gray-800 px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-gray-400">🔍</span>
                <span className="text-gray-200 text-sm font-medium">Find Airport</span>
              </div>
              <div className="relative" ref={searchInputRef}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSearchResults(true);
                  }}
                  onFocus={() => setShowSearchResults(true)}
                  placeholder="Search by code or name..."
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
                {showSearchResults && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-48 overflow-y-auto z-50">
                    {searchResults.map((point) => (
                      <button
                        key={point.airport.code}
                        onClick={() => {
                          onAirportSelect(point.airport.code);
                          setSearchQuery('');
                          setShowSearchResults(false);
                          setIsOpen(false);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-gray-700 transition-colors"
                      >
                        <div className="text-cyan-400 text-sm font-medium">
                          {point.airport.code}
                        </div>
                        <div className="text-gray-400 text-xs truncate">{point.airport.name}</div>
                        <div className="text-gray-500 text-xs">
                          {point.airport.municipality}, {point.airport.countryName}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {showSearchResults && searchQuery && searchResults.length === 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-3 text-center text-gray-500 text-sm">
                    No airports found
                  </div>
                )}
              </div>
            </div>

            {/* Year Filter Section */}
            <div className="border-b border-gray-800">
              <button
                onClick={() => toggleSection('year')}
                className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">📅</span>
                  <span className="text-gray-200 text-sm font-medium">Year</span>
                  {selectedYear && (
                    <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full">
                      {selectedYear}
                    </span>
                  )}
                </div>
                <span className="text-gray-500 text-xs">{expandedSections.year ? '▼' : '▶'}</span>
              </button>

              {expandedSections.year && (
                <div className="px-4 pb-4">
                  {/* All Years Button */}
                  <button
                    onClick={() => onYearChange(null)}
                    className={`w-full mb-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedYear === null
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    All Years ({flightCount} flights)
                  </button>

                  {/* Years by Decade */}
                  <div className="space-y-3">
                    {decades.map((decade) => (
                      <div key={decade}>
                        <div className="text-gray-500 text-xs uppercase tracking-wide mb-2">
                          {decade}s
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          {yearsByDecade[decade]
                            .sort((a, b) => b - a)
                            .map((year) => (
                              <button
                                key={year}
                                onClick={() => onYearChange(year)}
                                className={`px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                                  selectedYear === year
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                                }`}
                              >
                                {year}
                              </button>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
