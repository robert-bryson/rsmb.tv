import { ClickableAirport } from './ClickableAirport';

interface ClickableRouteProps {
  origin: string;
  destination: string;
  onAirportClick: (code: string) => void;
  onRouteClick: (origin: string, destination: string) => void;
  className?: string;
}

export function ClickableRoute({
  origin,
  destination,
  onAirportClick,
  onRouteClick,
  className = '',
}: ClickableRouteProps) {
  return (
    <span className={className}>
      <ClickableAirport code={origin} onClick={onAirportClick} className="text-gray-300" />
      <button
        onClick={() => onRouteClick(origin, destination)}
        className="text-gray-400 hover:text-purple-400 mx-1 transition-colors cursor-pointer"
        title="Zoom to route"
      >
        ↔
      </button>
      <ClickableAirport code={destination} onClick={onAirportClick} className="text-gray-300" />
    </span>
  );
}
