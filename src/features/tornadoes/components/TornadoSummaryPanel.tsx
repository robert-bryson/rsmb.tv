import {
    COLOR_MODE_LABELS,
    REGION_LABELS,
    SCALE_COLORS,
    SCALE_FILTER_LABELS,
    SCALE_LABELS,
} from '../constants';
import type {
    AnnualTornadoSummary,
    FilteredTornadoStats,
    NotableTornadoEvent,
    TornadoColorMode,
    TornadoMode,
    TornadoRegionPreset,
    TornadoScaleFilter,
    TornadoTrackFeature,
} from '../types';
import { formatDamage, formatDateTime } from '../utils';

interface TornadoSummaryPanelProps {
    stats: FilteredTornadoStats;
    selectedTrack: TornadoTrackFeature | null;
    notableEvents: NotableTornadoEvent[];
    annualSummary: AnnualTornadoSummary[];
    startYear: number;
    endYear: number;
    scaleFilter: TornadoScaleFilter;
    region: TornadoRegionPreset;
    colorMode: TornadoColorMode;
    mode: TornadoMode;
    collapsed?: boolean;
    onCollapseChange?: (collapsed: boolean) => void;
    onScaleFilterChange: (value: TornadoScaleFilter) => void;
    onRegionChange: (value: TornadoRegionPreset) => void;
    onColorModeChange: (value: TornadoColorMode) => void;
    onModeChange: (value: TornadoMode) => void;
    onSelectEvent: (event: NotableTornadoEvent) => void;
    onCloseSelection: () => void;
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-md bg-zinc-900/80 p-2">
            <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
            <div className="mt-1 text-sm font-semibold text-zinc-100">{value}</div>
        </div>
    );
}

function TrendSnapshot({ annualSummary, startYear, endYear }: { annualSummary: AnnualTornadoSummary[]; startYear: number; endYear: number }) {
    const years = annualSummary.filter((summary) => summary.year >= startYear && summary.year <= endYear);
    const peakYears = [...years].sort((a, b) => b.count - a.count).slice(0, 5);
    const maxCount = Math.max(1, ...peakYears.map((summary) => summary.count));

    return (
        <section className="border-t border-zinc-800 pt-4">
            <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Trend Snapshot</div>
            <div className="space-y-2">
                {peakYears.map((summary) => (
                    <div key={summary.year}>
                        <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                            <span className="font-medium text-zinc-200">{summary.year}</span>
                            <span className="text-zinc-500">{summary.count.toLocaleString()} tracks · {summary.ef2Plus.toLocaleString()} EF2+</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-zinc-800">
                            <div className="h-1.5 rounded-full bg-sky-400" style={{ width: `${Math.max(4, (summary.count / maxCount) * 100)}%` }} />
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

export function TornadoSummaryPanel({
    stats,
    selectedTrack,
    notableEvents,
    annualSummary,
    startYear,
    endYear,
    scaleFilter,
    region,
    colorMode,
    mode,
    collapsed = false,
    onCollapseChange,
    onScaleFilterChange,
    onRegionChange,
    onColorModeChange,
    onModeChange,
    onSelectEvent,
    onCloseSelection,
}: TornadoSummaryPanelProps) {
    const selected = selectedTrack?.properties;

    return (
        <aside className="absolute right-3 top-20 z-20 hidden max-h-[calc(100dvh-220px)] w-80 overflow-y-auto rounded-lg border border-zinc-700/80 bg-zinc-950/90 text-sm text-zinc-300 shadow-2xl backdrop-blur-md md:block">
            <div className="flex items-start justify-between gap-3 p-4">
                <div>
                    <div className="text-xs uppercase tracking-wide text-zinc-500">Tornado Tracks</div>
                    <h2 className="text-lg font-semibold text-zinc-100">{stats.count.toLocaleString()} tracks</h2>
                </div>
                <div className="flex items-center gap-1">
                    {selected && (
                        <button type="button" onClick={onCloseSelection} className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100">
                            Clear
                        </button>
                    )}
                    {onCollapseChange && (
                        <button
                            type="button"
                            onClick={() => onCollapseChange(!collapsed)}
                            className="rounded-md p-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                            aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
                        >
                            {collapsed ? '▼' : '▲'}
                        </button>
                    )}
                </div>
            </div>

            {!collapsed && (
                <div className="px-4 pb-4">
                    <div className="mb-4 grid grid-cols-2 gap-2">
                        <Stat label="EF2+" value={stats.ef2Plus.toLocaleString()} />
                        <Stat label="Deaths" value={stats.deaths.toLocaleString()} />
                        <Stat label="Injuries" value={stats.injuries.toLocaleString()} />
                        <Stat label="Miles" value={Math.round(stats.trackMiles).toLocaleString()} />
                    </div>

                    <div className="mb-4 space-y-3">
                        <div>
                            <div className="mb-1.5 text-xs uppercase tracking-wide text-zinc-500">Mode</div>
                            <div className="grid grid-cols-3 rounded-md bg-zinc-900 p-1 text-xs">
                                {(['tracks', 'density', 'trends'] as TornadoMode[]).map((value) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => onModeChange(value)}
                                        className={`rounded px-2 py-1.5 capitalize ${mode === value ? 'bg-sky-500 text-zinc-950' : 'text-zinc-400 hover:text-zinc-100'}`}
                                    >
                                        {value}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <div className="mb-1.5 text-xs uppercase tracking-wide text-zinc-500">Scale</div>
                            <div className="grid grid-cols-4 gap-1 text-xs">
                                {(['all', 'ef1plus', 'ef2plus', 'ef3plus'] as TornadoScaleFilter[]).map((value) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => onScaleFilterChange(value)}
                                        className={`rounded-md px-2 py-1.5 ${scaleFilter === value ? 'bg-sky-500 text-zinc-950' : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'}`}
                                    >
                                        {SCALE_FILTER_LABELS[value]}
                                    </button>
                                ))}
                            </div>
                            <div className="mt-1 grid grid-cols-6 gap-1 text-xs">
                                {(['ef0', 'ef1', 'ef2', 'ef3', 'ef4', 'ef5'] as TornadoScaleFilter[]).map((value) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => onScaleFilterChange(value)}
                                        className={`rounded-md px-1 py-1.5 ${scaleFilter === value ? 'bg-sky-500 text-zinc-950' : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'}`}
                                    >
                                        {SCALE_FILTER_LABELS[value]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <label className="grid gap-1.5 text-xs text-zinc-500">
                            Region
                            <select
                                value={region}
                                onChange={(event) => onRegionChange(event.target.value as TornadoRegionPreset)}
                                className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-100"
                            >
                                {(Object.keys(REGION_LABELS) as TornadoRegionPreset[]).map((value) => (
                                    <option key={value} value={value}>{REGION_LABELS[value]}</option>
                                ))}
                            </select>
                        </label>

                        <div>
                            <div className="mb-1.5 text-xs uppercase tracking-wide text-zinc-500">Color</div>
                            <div className="grid grid-cols-2 gap-1 text-xs">
                                {(Object.keys(COLOR_MODE_LABELS) as TornadoColorMode[]).map((value) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => onColorModeChange(value)}
                                        className={`rounded-md px-2 py-1.5 ${colorMode === value ? 'bg-sky-500 text-zinc-950' : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'}`}
                                    >
                                        {COLOR_MODE_LABELS[value]}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="mb-4">
                        <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Legend</div>
                        <div className="grid grid-cols-2 gap-1.5 text-xs">
                            {[-1, 0, 1, 2, 3, 4, 5].map((scale) => (
                                <div key={scale} className="flex items-center gap-2">
                                    <span className="h-2.5 w-5 rounded-full" style={{ backgroundColor: SCALE_COLORS[scale] }} />
                                    <span className="text-zinc-400">{SCALE_LABELS[scale]}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {selected ? (
                        <section className="border-t border-zinc-800 pt-4">
                            <div className="mb-2 flex items-center gap-2">
                                <span className="rounded px-2 py-0.5 text-xs font-semibold text-zinc-950" style={{ backgroundColor: SCALE_COLORS[selected.scale] ?? SCALE_COLORS[-1] }}>
                                    {selected.scaleLabel}
                                </span>
                                <h3 className="font-semibold text-zinc-100">{selected.county}, {selected.state}</h3>
                            </div>
                            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                                <dt className="text-zinc-500">Time</dt><dd className="text-zinc-200">{formatDateTime(selected.beginTime)}</dd>
                                <dt className="text-zinc-500">WFO</dt><dd className="text-zinc-200">{selected.wfo || 'Unknown'}</dd>
                                <dt className="text-zinc-500">Length</dt><dd className="text-zinc-200">{selected.lengthMiles.toLocaleString()} mi</dd>
                                <dt className="text-zinc-500">Width</dt><dd className="text-zinc-200">{selected.widthYards.toLocaleString()} yd</dd>
                                <dt className="text-zinc-500">Deaths</dt><dd className="text-zinc-200">{selected.deaths.toLocaleString()}</dd>
                                <dt className="text-zinc-500">Injuries</dt><dd className="text-zinc-200">{selected.injuries.toLocaleString()}</dd>
                                <dt className="text-zinc-500">Property</dt><dd className="text-zinc-200">{formatDamage(selected.propertyDamage)}</dd>
                                <dt className="text-zinc-500">Source</dt><dd className="text-zinc-200">{selected.source || selected.dataSource}</dd>
                            </dl>
                            {(selected.narrative || selected.episodeNarrative) && (
                                <p className="mt-3 text-xs leading-relaxed text-zinc-400">
                                    {selected.narrative || selected.episodeNarrative}
                                </p>
                            )}
                        </section>
                    ) : mode === 'trends' ? (
                        <TrendSnapshot annualSummary={annualSummary} startYear={startYear} endYear={endYear} />
                    ) : (
                        <section className="border-t border-zinc-800 pt-4">
                            <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Notable</div>
                            <div className="space-y-1.5">
                                {notableEvents.slice(0, 6).map((event) => (
                                    <button
                                        key={event.id}
                                        type="button"
                                        onClick={() => onSelectEvent(event)}
                                        className="block w-full rounded-md bg-zinc-900/70 px-2.5 py-2 text-left hover:bg-zinc-800"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-medium text-zinc-200">{event.county}, {event.state}</span>
                                            <span className="text-xs text-zinc-400">{event.scaleLabel}</span>
                                        </div>
                                        <div className="text-xs text-zinc-500">{event.date} · {event.lengthMiles.toLocaleString()} mi · {event.deaths.toLocaleString()} deaths</div>
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            )}
        </aside>
    );
}