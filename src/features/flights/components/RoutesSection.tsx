import { useState } from 'react';
import { CollapsibleSection, ClickableRoute } from './shared';
import type { RouteStats } from '../types';

interface RoutesSectionProps {
  busiestRoutes: RouteStats[];
  onAirportClick: (code: string) => void;
  onRouteClick: (origin: string, destination: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function RoutesSection({
  busiestRoutes,
  onAirportClick,
  onRouteClick,
  isOpen,
  onToggle,
}: RoutesSectionProps) {
  const [showAll, setShowAll] = useState(false);

  const INITIAL_VISIBLE = 5;
  const hasMore = busiestRoutes.length > INITIAL_VISIBLE;
  const visibleRoutes = showAll ? busiestRoutes : busiestRoutes.slice(0, INITIAL_VISIBLE);

  return (
    <CollapsibleSection
      title={`Top Routes (${busiestRoutes.length})`}
      icon="🔀"
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className="space-y-1">
        {visibleRoutes.map((route) => (
          <div key={route.routeKey} className="flex justify-between text-gray-300 text-sm">
            <ClickableRoute
              origin={route.origin}
              destination={route.destination}
              onAirportClick={onAirportClick}
              onRouteClick={onRouteClick}
            />
            <span className="text-purple-400">×{route.count}</span>
          </div>
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-2 text-xs text-purple-400 hover:text-purple-300 transition-colors"
        >
          {showAll ? '← Show less' : `Show ${busiestRoutes.length - INITIAL_VISIBLE} more →`}
        </button>
      )}
    </CollapsibleSection>
  );
}
