interface ClickableRegionProps {
    code: string;
    name: string;
    onClick: (code: string) => void;
    className?: string;
}

export function ClickableRegion({
    code,
    name,
    onClick,
    className = '',
}: ClickableRegionProps) {
    return (
        <button
            onClick={() => onClick(code)}
            className={`text-amber-400 hover:text-amber-300 hover:underline transition-colors cursor-pointer ${className}`}
        >
            {name}
        </button>
    );
}
