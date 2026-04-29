interface ChartEmptyStateProps {
    message: string;
}

export function ChartEmptyState({ message }: ChartEmptyStateProps) {
    return (
        <div className="h-full min-h-40 rounded border border-zinc-800 bg-zinc-900/40 grid place-items-center px-4 text-center text-xs text-zinc-500">
            {message}
        </div>
    );
}
