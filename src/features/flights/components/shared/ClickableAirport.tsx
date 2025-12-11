interface ClickableAirportProps {
  code: string;
  onClick: (code: string) => void;
  className?: string;
  /** If provided, the airport code must be in this set to be clickable */
  validAirports?: Set<string>;
}

export function ClickableAirport({
  code,
  onClick,
  className = '',
  validAirports,
}: ClickableAirportProps) {
  // If validAirports is provided and code is not in the set, render as plain text
  const isClickable = !validAirports || validAirports.has(code);
  
  if (!isClickable) {
    return <span className={`text-gray-500 ${className}`}>{code}</span>;
  }
  
  return (
    <button
      onClick={() => onClick(code)}
      className={`text-cyan-400 hover:text-cyan-300 hover:underline transition-colors cursor-pointer ${className}`}
    >
      {code}
    </button>
  );
}
