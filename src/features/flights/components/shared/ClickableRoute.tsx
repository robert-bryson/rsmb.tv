import { ClickableAirport } from './ClickableAirport';

interface ClickableRouteProps {
  origin: string;
  destination: string;
  onAirportClick: (code: string) => void;
  onRouteClick: (origin: string, destination: string) => void;
  className?: string;
  validAirports?: Set<string>;
  airportNames?: Map<string, string>;
}

export function ClickableRoute({
  origin,
  destination,
  onAirportClick,
  onRouteClick,
  className = '',
  validAirports,
  airportNames,
}: ClickableRouteProps) {
  return (
    <span className={className}>
      <ClickableAirport
        code={origin}
        onClick={onAirportClick}
        className="text-gray-300"
        validAirports={validAirports}
        airportNames={airportNames}
      />
      <button
        type="button"
        onClick={() => onRouteClick(origin, destination)}
        className="text-gray-400 hover:text-purple-400 mx-1 transition-colors cursor-pointer"
        title="Zoom to route"
        aria-label={`Select route ${origin} to ${destination}`}
      >
        ↔
      </button>
      <ClickableAirport
        code={destination}
        onClick={onAirportClick}
        className="text-gray-300"
        validAirports={validAirports}
        airportNames={airportNames}
      />
    </span>
  );
}
