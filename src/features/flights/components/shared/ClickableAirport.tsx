interface ClickableAirportProps {
  code: string;
  onClick: (code: string) => void;
  className?: string;
}

export function ClickableAirport({
  code,
  onClick,
  className = '',
}: ClickableAirportProps) {
  return (
    <button
      onClick={() => onClick(code)}
      className={`text-cyan-400 hover:text-cyan-300 hover:underline transition-colors cursor-pointer ${className}`}
    >
      {code}
    </button>
  );
}
