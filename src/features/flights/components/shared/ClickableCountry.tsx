interface ClickableCountryProps {
    code: string;
    name: string;
    onClick: (code: string) => void;
    className?: string;
}

export function ClickableCountry({
    code,
    name,
    onClick,
    className = '',
}: ClickableCountryProps) {
    return (
        <button
            onClick={() => onClick(code)}
            className={`text-emerald-400 hover:text-emerald-300 hover:underline transition-colors cursor-pointer ${className}`}
        >
            {name}
        </button>
    );
}
