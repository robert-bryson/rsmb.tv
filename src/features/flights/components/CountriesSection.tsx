import { useState } from 'react';
import { CollapsibleSection } from './shared';

interface CountriesSectionProps {
  topCountries: { code: string; name: string; count: number; departures: number; arrivals: number }[];
  onCountryClick: (countryCode: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function CountriesSection({
  topCountries,
  onCountryClick,
  isOpen,
  onToggle,
}: CountriesSectionProps) {
  const [showAll, setShowAll] = useState(false);

  const INITIAL_VISIBLE = 5;
  const hasMore = topCountries.length > INITIAL_VISIBLE;
  const visibleCountries = showAll ? topCountries : topCountries.slice(0, INITIAL_VISIBLE);

  return (
    <CollapsibleSection
      title={`Countries (${topCountries.length})`}
      icon="🌍"
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className="space-y-1">
        {visibleCountries.map(({ code, name, count, arrivals, departures }) => (
          <div key={code} className="flex justify-between items-center text-xs">
            <button
              onClick={() => onCountryClick(code)}
              className="text-gray-300 hover:text-cyan-400 transition-colors text-left truncate max-w-[180px]"
              title={name}
            >
              {name}
            </button>
            <span className="text-gray-500 ml-2 whitespace-nowrap">
              <span className="text-yellow-400">{count}</span>
              <span className="text-gray-600 mx-1">✈</span>
              <span className="text-green-400">{arrivals}</span>↓
              <span className="text-blue-400">{departures}</span>↑
            </span>
          </div>
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-2 text-xs text-purple-400 hover:text-purple-300 transition-colors"
        >
          {showAll ? '← Show less' : `Show ${topCountries.length - INITIAL_VISIBLE} more →`}
        </button>
      )}
    </CollapsibleSection>
  );
}
