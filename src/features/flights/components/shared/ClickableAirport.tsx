interface ClickableAirportProps {
  code: string;
  onClick: (code: string) => void;
  className?: string;
  /** If provided, the airport code must be in this set to be clickable */
  validAirports?: Set<string>;
  /** If provided, used to show the airport full name as a tooltip */
  airportNames?: Map<string, string>;
}

export function ClickableAirport({
  code,
  onClick,
  className = '',
  validAirports,
  airportNames,
}: ClickableAirportProps) {
  // If validAirports is provided and code is not in the set, render as plain text
  const isClickable = !validAirports || validAirports.has(code);
  const title = airportNames?.get(code);

  if (!isClickable) {
    return <span className={`text-gray-500 ${className}`} title={title}>{code}</span>;
  }

  return (
    <button
      type="button"
      onClick={() => onClick(code)}
      className={`text-cyan-400 hover:text-cyan-300 hover:underline transition-colors cursor-pointer ${className}`}
      title={title}
    >
      {code}
    </button>
  );
}
