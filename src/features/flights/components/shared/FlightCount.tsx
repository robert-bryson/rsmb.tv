interface FlightCountProps {
  count: number;
  showArrivals?: boolean;
  showDepartures?: boolean;
  arrivals?: number;
  departures?: number;
}

export function FlightCount({
  count,
  showArrivals,
  showDepartures,
  arrivals,
  departures,
}: FlightCountProps) {
  return (
    <>
      <span className="text-yellow-400">{count}</span>✈
      {showArrivals && arrivals !== undefined && (
        <>
          {' '}
          <span className="text-green-400">{arrivals}</span>↓
        </>
      )}
      {showDepartures && departures !== undefined && (
        <>
          {' '}
          <span className="text-blue-400">{departures}</span>↑
        </>
      )}
    </>
  );
}
