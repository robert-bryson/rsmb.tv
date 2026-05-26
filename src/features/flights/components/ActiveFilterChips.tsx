import { memo } from 'react';

interface FilterChip {
    key: string;
    label: string;
    value: string;
    color: string;
    onClear: () => void;
}

interface ActiveFilterChipsProps {
    selectedYear: number | null;
    selectedAirport: string | null;
    selectedAirline: string | null;
    selectedRoute: string | null;
    selectedCountry: string | null;
    selectedRegion: string | null;
    onClearYear: () => void;
    onClearAirport: () => void;
    onClearAirline: () => void;
    onClearRoute: () => void;
    onClearCountry: () => void;
    onClearRegion: () => void;
}

const colorClasses: Record<string, string> = {
    purple: 'border-purple-500/40 bg-purple-950/60 text-purple-200',
    cyan: 'border-cyan-500/40 bg-cyan-950/60 text-cyan-200',
    orange: 'border-orange-500/40 bg-orange-950/60 text-orange-200',
    yellow: 'border-yellow-500/40 bg-yellow-950/60 text-yellow-200',
    emerald: 'border-emerald-500/40 bg-emerald-950/60 text-emerald-200',
    amber: 'border-amber-500/40 bg-amber-950/60 text-amber-200',
};

export const ActiveFilterChips = memo(function ActiveFilterChips({
    selectedYear,
    selectedAirport,
    selectedAirline,
    selectedRoute,
    selectedCountry,
    selectedRegion,
    onClearYear,
    onClearAirport,
    onClearAirline,
    onClearRoute,
    onClearCountry,
    onClearRegion,
}: ActiveFilterChipsProps) {
    const chips: FilterChip[] = [
        selectedYear !== null && {
            key: 'year',
            label: 'Year',
            value: String(selectedYear),
            color: 'purple',
            onClear: onClearYear,
        },
        selectedAirport && {
            key: 'airport',
            label: 'Airport',
            value: selectedAirport,
            color: 'cyan',
            onClear: onClearAirport,
        },
        selectedAirline && {
            key: 'airline',
            label: 'Airline',
            value: selectedAirline,
            color: 'orange',
            onClear: onClearAirline,
        },
        selectedRoute && {
            key: 'route',
            label: 'Route',
            value: selectedRoute,
            color: 'yellow',
            onClear: onClearRoute,
        },
        selectedCountry && {
            key: 'country',
            label: 'Country',
            value: selectedCountry,
            color: 'emerald',
            onClear: onClearCountry,
        },
        selectedRegion && {
            key: 'region',
            label: 'Region',
            value: selectedRegion,
            color: 'amber',
            onClear: onClearRegion,
        },
    ].filter(Boolean) as FilterChip[];

    if (chips.length === 0) return null;

    return (
        <div
            className="absolute bottom-[calc(env(safe-area-inset-bottom,0px)+4.75rem)] left-4 right-16 sm:right-auto z-20 flex max-w-[calc(100vw-5rem)] flex-wrap gap-2"
            aria-label="Active flight filters"
        >
            {chips.map((chip) => (
                <span
                    key={chip.key}
                    className={`inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs shadow-lg backdrop-blur ${colorClasses[chip.color]}`}
                >
                    <span className="text-white/50">{chip.label}</span>
                    <span className="truncate font-semibold">{chip.value}</span>
                    <button
                        type="button"
                        onClick={chip.onClear}
                        className="-mr-1 rounded p-0.5 text-current opacity-70 transition hover:bg-white/10 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
                        aria-label={`Clear ${chip.label.toLowerCase()} filter`}
                    >
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </span>
            ))}
        </div>
    );
});
