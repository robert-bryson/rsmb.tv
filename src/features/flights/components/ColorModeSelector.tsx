import { useState } from 'react';
import type { ColorMode } from '../types';

// Year color scale for legend
const YEAR_COLORS: Record<number, string> = {
  2008: '#3b82f6', 2009: '#6366f1', 2010: '#8b5cf6', 2011: '#a855f7',
  2012: '#c026d3', 2013: '#d946ef', 2014: '#e879f9', 2015: '#f472b6',
  2016: '#fb7185', 2017: '#f43f5e', 2018: '#ef4444', 2019: '#f97316',
  2020: '#fb923c', 2021: '#fbbf24', 2022: '#facc15', 2023: '#a3e635',
  2024: '#4ade80', 2025: '#22d3ee',
};

interface ColorModeSelectorProps {
  mode: ColorMode;
  onModeChange: (mode: ColorMode) => void;
  years?: number[];
}

export function ColorModeSelector({ mode, onModeChange, years = [] }: ColorModeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const modes: { value: ColorMode; label: string; icon: string }[] = [
    { value: 'default', label: 'Default', icon: '🎨' },
    { value: 'year', label: 'By Year', icon: '📅' },
    { value: 'frequency', label: 'By Frequency', icon: '🔥' },
    { value: 'airline', label: 'By Airline', icon: '✈️' },
  ];

  const currentMode = modes.find((m) => m.value === mode);

  // Get unique years for legend, sorted
  const sortedYears = [...years].sort((a, b) => a - b);

  return (
    <div className="absolute bottom-4 right-4 z-10">
      {/* Collapsed: just show icon button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-gray-900/90 backdrop-blur p-2.5 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800/90 transition-colors"
          title={`Color: ${currentMode?.label}`}
        >
          <span className="text-lg">{currentMode?.icon}</span>
        </button>
      )}

      {/* Expanded: show full selector */}
      {isOpen && (
        <div className="bg-gray-900/90 backdrop-blur rounded-lg border border-gray-700 p-3 max-w-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="text-gray-400 text-xs uppercase tracking-wide">Color Mode</div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {modes.map((m) => (
              <button
                key={m.value}
                onClick={() => {
                  onModeChange(m.value);
                  // Keep open to show legend if year mode selected
                  if (m.value !== 'year' && m.value !== 'frequency') {
                    setIsOpen(false);
                  }
                }}
                className={`px-3 py-1.5 rounded text-xs text-left transition-colors flex items-center gap-2 ${
                  mode === m.value
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                <span>{m.icon}</span>
                <span>{m.label}</span>
              </button>
            ))}
          </div>

          {/* Year Color Legend */}
          {mode === 'year' && sortedYears.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-700">
              <div className="text-gray-500 text-xs mb-2">Year Legend</div>
              <div className="flex flex-wrap gap-1">
                {sortedYears.map((year) => (
                  <div
                    key={year}
                    className="flex items-center gap-1 text-xs"
                    title={year.toString()}
                  >
                    <span
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: YEAR_COLORS[year] || '#a855f7' }}
                    />
                    <span className="text-gray-400">{year}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Frequency Color Legend */}
          {mode === 'frequency' && (
            <div className="mt-3 pt-3 border-t border-gray-700">
              <div className="text-gray-500 text-xs mb-2">Frequency Legend</div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#ef4444' }} />
                  <span className="text-gray-400">Very frequent (70%+)</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#f97316' }} />
                  <span className="text-gray-400">Frequent (40-70%)</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#facc15' }} />
                  <span className="text-gray-400">Moderate (20-40%)</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#a855f7' }} />
                  <span className="text-gray-400">Occasional (&lt;20%)</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
