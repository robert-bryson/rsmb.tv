interface TechBadgesProps {
    tech: readonly string[];
    className?: string;
}

export function TechBadges({ tech, className = '' }: TechBadgesProps) {
    return (
        <div className={`flex flex-wrap gap-2 ${className}`.trim()}>
            {tech.map(name => (
                <span key={name} className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                    {name}
                </span>
            ))}
        </div>
    );
}
