import { useState } from 'react';
import { CollapsibleSection } from './shared';

interface RegionsSectionProps {
  topRegions: { code: string; name: string; country: string; count: number }[];
  onRegionClick: (regionCode: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function RegionsSection({
  topRegions,
  onRegionClick,
  isOpen,
  onToggle,
}: RegionsSectionProps) {
  const [showAll, setShowAll] = useState(false);

  const INITIAL_VISIBLE = 5;
  const hasMore = topRegions.length > INITIAL_VISIBLE;
  const visibleRegions = showAll ? topRegions : topRegions.slice(0, INITIAL_VISIBLE);

  return (
    <CollapsibleSection
      title={`Regions (${topRegions.length})`}
      icon="📍"
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className="space-y-1">
        {visibleRegions.map(({ code, name, country, count }) => (
          <div key={code} className="flex justify-between items-center text-xs">
            <button
              onClick={() => onRegionClick(code)}
              className="text-gray-300 hover:text-cyan-400 transition-colors text-left truncate max-w-[180px]"
              title={`${name}, ${country}`}
            >
              {name}
              <span className="text-gray-600 ml-1">({country})</span>
            </button>
            <span className="text-purple-400 ml-2">×{count}</span>
          </div>
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-2 text-xs text-purple-400 hover:text-purple-300 transition-colors"
        >
          {showAll ? '← Show less' : `Show ${topRegions.length - INITIAL_VISIBLE} more →`}
        </button>
      )}
    </CollapsibleSection>
  );
}
