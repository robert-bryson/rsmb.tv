import { useState } from 'react';
import { CollapsibleSection } from './shared';

interface AirlinesSectionProps {
  airlineCounts: { airline: string; count: number }[];
  selectedAirline: string | null;
  onAirlineSelect: (airline: string | null) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function AirlinesSection({
  airlineCounts,
  selectedAirline,
  onAirlineSelect,
  isOpen,
  onToggle,
}: AirlinesSectionProps) {
  const [showAll, setShowAll] = useState(false);

  // Calculate how many airlines fit in ~2 rows (approximately 6-8 items)
  const INITIAL_VISIBLE = 6;
  const hasMore = airlineCounts.length > INITIAL_VISIBLE;
  const visibleAirlines = showAll ? airlineCounts : airlineCounts.slice(0, INITIAL_VISIBLE);

  return (
    <CollapsibleSection
      title={`Airlines (${airlineCounts.length})`}
      icon="✈️"
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => onAirlineSelect(null)}
          className={`px-2 py-1 rounded text-xs transition-colors ${
            selectedAirline === null
              ? 'bg-orange-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          All
        </button>
        {visibleAirlines.map(({ airline, count }) => (
          <button
            key={airline}
            onClick={() => onAirlineSelect(selectedAirline === airline ? null : airline)}
            className={`px-2 py-1 rounded text-xs transition-colors ${
              selectedAirline === airline
                ? 'bg-orange-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {airline || '(Unknown)'} <span className="text-orange-400">×{count}</span>
          </button>
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-2 text-xs text-purple-400 hover:text-purple-300 transition-colors"
        >
          {showAll ? '← Show less' : `Show ${airlineCounts.length - INITIAL_VISIBLE} more →`}
        </button>
      )}
    </CollapsibleSection>
  );
}
