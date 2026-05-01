import { useCallback, useMemo, useState } from 'react';
import {
    COLOR_MODE_LABELS,
    DECADE_COLORS,
    REGION_LABELS,
    SCALE_COLORS,
    SCALE_FILTER_LABELS,
    SCALE_LABELS,
    YEAR_COLOR_STOPS,
} from '../constants';
import type {
    AnnualTornadoSummary,
    AnnualWarningSummary,
    FilteredTornadoStats,
    NotableTornadoEvent,
    StateAggregateSummary,
    TornadoColorMode,
    TornadoMode,
    TornadoRegionPreset,
    TornadoScaleFilter,
    TornadoTrackFeature,
    WfoWarningYearSummary,
    WarningSummary,
} from '../types';
import { computeDecades, computeFullHistory, computeSparklinePills, formatDamage, formatDateTime, linReg } from '../utils';

interface TornadoSummaryPanelProps {
    stats: FilteredTornadoStats;
    stateBreakdown: StateAggregateSummary[];
    selectedTrack: TornadoTrackFeature | null;
    notableEvents: NotableTornadoEvent[];
    annualSummary: AnnualTornadoSummary[];
    warningSummary: WarningSummary | null;
    startYear: number;
    endYear: number;
    scaleFilter: TornadoScaleFilter;
    region: TornadoRegionPreset;
    colorMode: TornadoColorMode;
    mode: TornadoMode;
    selectedState: string | null;
    selectedStateName: string | null;
    shareCopied: boolean;
    collapsed?: boolean;
    onCollapseChange?: (collapsed: boolean) => void;
    onScaleFilterChange: (value: TornadoScaleFilter) => void;
    onRegionChange: (value: TornadoRegionPreset) => void;
    onSelectedStateChange: (value: string | null) => void;
    onColorModeChange: (value: TornadoColorMode) => void;
    onModeChange: (value: TornadoMode) => void;
    onSelectEvent: (event: NotableTornadoEvent) => void;
    onShare: () => void;
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

// ---------------------------------------------------------------------------
// Option A — Full-history sparkline: selected range highlighted, regression
// overlay, three comparison pills (selected vs full history)
// ---------------------------------------------------------------------------

function TrendSparkline({ allYears, startYear, endYear }: {
    allYears: AnnualTornadoSummary[];
    startYear: number;
    endYear: number;
}) {
    const { slope, intercept } = useMemo(
        () => linReg(allYears.map(d => ({ x: d.year, y: d.count }))),
        [allYears],
    );
    const pills = useMemo(
        () => computeSparklinePills(allYears, startYear, endYear),
        [allYears, startYear, endYear],
    );

    const n = allYears.length;
    if (n === 0) return null;

    const maxCount = Math.max(1, ...allYears.map(d => d.count));
    const W = 272; const H = 52;
    const barW = W / n;
    const minYear = allYears[0].year;
    const maxYear = allYears[n - 1].year;
    const toY = (v: number) => H - (v / maxCount) * H;
    const ry1 = toY(slope * minYear + intercept);
    const ry2 = toY(slope * maxYear + intercept);
    const slopeLabel = `${slope >= 0 ? '+' : ''}${slope.toFixed(1)}/yr trend`;

    return (
        <div>
            <div className="mb-1 flex items-center justify-between text-[10px] text-zinc-500">
                <span>Annual tornado count, {minYear}–{maxYear}</span>
                <span className="text-orange-400/80">— {slopeLabel}</span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} aria-hidden="true">
                {allYears.map((d, i) => {
                    const h = Math.max(1, (d.count / maxCount) * H);
                    return (
                        <rect
                            key={d.year}
                            x={i * barW + 0.3}
                            y={H - h}
                            width={Math.max(0.5, barW - 0.6)}
                            height={h}
                            fill={d.year >= startYear && d.year <= endYear ? '#38bdf8' : '#3f3f46'}
                        />
                    );
                })}
                <line x1={0} y1={ry1} x2={W} y2={ry2}
                    stroke="#f97316" strokeWidth="1" strokeDasharray="3,2" opacity="0.75" />
            </svg>
            <div className="flex justify-between text-[10px] text-zinc-600">
                <span>{minYear}</span><span>{maxYear}</span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1 text-[11px]">
                {pills.map(({ label, selValue, histValue, higherIsBad }) => {
                    const higher = selValue > histValue;
                    const accent = higher
                        ? (higherIsBad ? 'text-orange-400' : 'text-sky-400')
                        : (higherIsBad ? 'text-emerald-400' : 'text-zinc-500');
                    const selDisplay = label === 'EF2%'
                        ? `${selValue.toFixed(0)}%`
                        : Math.round(selValue).toLocaleString();
                    const histDisplay = label === 'EF2%'
                        ? `${histValue.toFixed(0)}%`
                        : Math.round(histValue).toLocaleString();
                    return (
                        <div key={label} className="rounded bg-zinc-900 p-1.5">
                            <div className="text-[10px] text-zinc-500">{label}</div>
                            <div className="font-semibold text-zinc-100">{selDisplay}</div>
                            <div className={`text-[10px] ${accent}`}>{higher ? '▲' : '▼'} {histDisplay}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Option B — Dual-metric: bar chart of annual count overlaid with a line
// showing deaths per 100 tornadoes. The key story: counts tripled while
// lethality dropped 7×. Selected range bars are highlighted.
// ---------------------------------------------------------------------------

function TrendDualMetric({ allYears, startYear, endYear }: {
    allYears: AnnualTornadoSummary[];
    startYear: number;
    endYear: number;
}) {
    const n = allYears.length;
    if (n === 0) return null;

    const maxCount = Math.max(1, ...allYears.map(d => d.count));
    const dPer100 = allYears.map(d => (d.count > 0 ? (d.deaths / d.count) * 100 : 0));
    const maxD = Math.max(1, ...dPer100);
    const W = 272; const H = 52;
    const barW = W / n;

    const linePoints = allYears.map((_d, i) => {
        const x = (i * barW + barW / 2).toFixed(1);
        const y = (H - (dPer100[i] / maxD) * H).toFixed(1);
        return `${x},${y}`;
    }).join(' ');

    const firstYear = allYears[0].year;
    const lastYear = allYears[n - 1].year;
    const firstD = dPer100[0].toFixed(0);
    const lastD = dPer100[n - 1].toFixed(0);

    return (
        <div>
            <div className="mb-1 flex gap-3 text-[10px] text-zinc-500">
                <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-3 rounded-sm bg-emerald-600/70" />
                    Tornadoes/yr
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="inline-block h-0.5 w-3 bg-rose-400" />
                    Deaths per 100
                </span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} aria-hidden="true">
                {allYears.map((d, i) => {
                    const h = Math.max(1, (d.count / maxCount) * H);
                    return (
                        <rect
                            key={d.year}
                            x={i * barW + 0.3}
                            y={H - h}
                            width={Math.max(0.5, barW - 0.6)}
                            height={h}
                            fill={d.year >= startYear && d.year <= endYear ? '#10b981' : '#27272a'}
                        />
                    );
                })}
                <polyline points={linePoints} fill="none" stroke="#fb7185" strokeWidth="1.3" opacity="0.9" />
            </svg>
            <div className="flex justify-between text-[10px] text-zinc-600">
                <span>{firstYear} · ~{firstD} d/100</span>
                <span>{lastYear} · ~{lastD} d/100</span>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Option C — Decade comparison. Horizontal bar chart with a metric toggle
// (Avg/yr, Deaths/yr, EF2+%, Deaths per 100). Each bar is tinted with the
// decade's map colour so users can link the chart back to the map.
// ---------------------------------------------------------------------------

type DecadeMetric = 'count' | 'deaths' | 'ef2pct' | 'd100';
const DECADE_METRIC_LABELS: Record<DecadeMetric, string> = {
    count: 'Avg/yr',
    deaths: 'Deaths/yr',
    ef2pct: 'EF2+%',
    d100: 'D/100',
};

function TrendDecadeTable({ allYears }: { allYears: AnnualTornadoSummary[] }) {
    const [metric, setMetric] = useState<DecadeMetric>('count');
    const decades = useMemo(() => computeDecades(allYears), [allYears]);
    if (!decades.length) return null;

    const getValue = (d: ReturnType<typeof computeDecades>[number]) => {
        if (metric === 'count') return d.avgCount;
        if (metric === 'deaths') return d.avgDeaths;
        if (metric === 'ef2pct') return d.ef2Pct;
        return d.dPer100;
    };

    const maxValue = Math.max(1, ...decades.map(getValue));

    return (
        <div>
            {/* Metric toggle */}
            <div className="mb-2 flex flex-wrap gap-1 text-[10px]">
                {(Object.keys(DECADE_METRIC_LABELS) as DecadeMetric[]).map((key) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => setMetric(key)}
                        className={`rounded px-1.5 py-0.5 ${metric === key ? 'bg-zinc-500 text-zinc-950' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'}`}
                    >
                        {DECADE_METRIC_LABELS[key]}
                    </button>
                ))}
            </div>
            {/* Bar chart */}
            <div className="space-y-1.5">
                {decades.map((d) => {
                    const color = DECADE_COLORS[d.decadeStart] ?? '#94a3b8';
                    const value = getValue(d);
                    const pct = (value / maxValue) * 100;
                    const display = metric === 'ef2pct' || metric === 'd100'
                        ? value.toFixed(1)
                        : Math.round(value).toLocaleString();
                    return (
                        <div key={d.label} className="flex items-center gap-2 text-[11px]">
                            <span className="w-10 shrink-0 text-zinc-400">{d.label}</span>
                            <div className="relative h-4 min-w-0 flex-1 overflow-hidden rounded-sm bg-zinc-900">
                                <div
                                    className="h-full rounded-sm transition-all duration-300"
                                    style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.75 }}
                                />
                            </div>
                            <span className="w-10 shrink-0 text-right text-zinc-300">{display}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Option D — Top states. Horizontal bar chart of the states with the most
// tornadoes in the selected filter window, with a metric toggle.
// ---------------------------------------------------------------------------

type StateMetric = 'count' | 'ef2pct' | 'deaths';
const STATE_METRIC_LABELS: Record<StateMetric, string> = {
    count: 'Count',
    ef2pct: 'EF2+%',
    deaths: 'Deaths',
};

/** Maximum number of states shown in the "Top states" bar chart. */
const TOP_STATES_COUNT = 12;

function TrendByState({ stateBreakdown }: { stateBreakdown: StateAggregateSummary[] }) {
    const [metric, setMetric] = useState<StateMetric>('count');

    const getValue = useCallback((row: StateAggregateSummary): number => {
        if (metric === 'ef2pct') return row.ef2Pct;
        if (metric === 'deaths') return row.deaths;
        return row.count;
    }, [metric]);

    // Re-sort by the active metric so the chart always reflects the true top-N.
    // `stateBreakdown` arrives sorted by count; slicing before re-sorting would
    // omit states that rank highly by deaths/ef2pct but lower by count.
    const rows = useMemo(
        () => [...stateBreakdown].sort((a, b) => getValue(b) - getValue(a)).slice(0, TOP_STATES_COUNT),
        [stateBreakdown, getValue],
    );

    if (!rows.length) return null;

    const maxValue = Math.max(1, ...rows.map(getValue));

    return (
        <div>
            <div className="mb-2 flex flex-wrap gap-1 text-[10px]">
                {(Object.keys(STATE_METRIC_LABELS) as StateMetric[]).map((key) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => setMetric(key)}
                        className={`rounded px-1.5 py-0.5 ${metric === key ? 'bg-zinc-500 text-zinc-950' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'}`}
                    >
                        {STATE_METRIC_LABELS[key]}
                    </button>
                ))}
            </div>
            <div className="space-y-1">
                {rows.map((row) => {
                    const value = getValue(row);
                    const pct = (value / maxValue) * 100;
                    const display = metric === 'ef2pct'
                        ? `${value.toFixed(0)}%`
                        : Math.round(value).toLocaleString();
                    return (
                        <div key={row.state} className="flex items-center gap-2 text-[11px]">
                            <span className="w-6 shrink-0 text-zinc-400">{row.state}</span>
                            <div className="relative h-3.5 min-w-0 flex-1 overflow-hidden rounded-sm bg-zinc-900">
                                <div
                                    className="h-full rounded-sm bg-sky-400/70 transition-all duration-300"
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                            <span className="w-10 shrink-0 text-right text-zinc-300">{display}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

type WarningAreaMetric = 'warnings' | 'tornadoWarnings' | 'matchedWarnings';
const WARNING_AREA_METRIC_LABELS: Record<WarningAreaMetric, string> = {
    warnings: 'Warnings',
    tornadoWarnings: 'TOR',
    matchedWarnings: 'Matched',
};

function emptyWarningTotals(): AnnualWarningSummary {
    return {
        year: 0,
        warnings: 0,
        tornadoWarnings: 0,
        severeThunderstormWarnings: 0,
        emergencyWarnings: 0,
        matchedWarnings: 0,
        tornadoMatchedWarnings: 0,
        severeThunderstormMatchedWarnings: 0,
        warningAreaKm2: 0,
        watches: 0,
        tornadoWatches: 0,
        severeThunderstormWatches: 0,
        pdsWatches: 0,
        matchedWatches: 0,
        tornadoMatchedWatches: 0,
        severeThunderstormMatchedWatches: 0,
    };
}

function addWarningRow(totals: AnnualWarningSummary, row: AnnualWarningSummary): AnnualWarningSummary {
    totals.warnings += row.warnings;
    totals.tornadoWarnings += row.tornadoWarnings;
    totals.severeThunderstormWarnings += row.severeThunderstormWarnings;
    totals.emergencyWarnings += row.emergencyWarnings;
    totals.matchedWarnings += row.matchedWarnings;
    totals.tornadoMatchedWarnings += row.tornadoMatchedWarnings;
    totals.severeThunderstormMatchedWarnings += row.severeThunderstormMatchedWarnings;
    totals.warningAreaKm2 += row.warningAreaKm2;
    totals.watches += row.watches;
    totals.tornadoWatches += row.tornadoWatches;
    totals.severeThunderstormWatches += row.severeThunderstormWatches;
    totals.pdsWatches += row.pdsWatches;
    totals.matchedWatches += row.matchedWatches;
    totals.tornadoMatchedWatches += row.tornadoMatchedWatches;
    totals.severeThunderstormMatchedWatches += row.severeThunderstormMatchedWatches;
    return totals;
}

function percent(numerator: number, denominator: number) {
    return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

function TrendWarnings({ warningSummary, startYear, endYear }: { warningSummary: WarningSummary | null; startYear: number; endYear: number }) {
    const [areaMetric, setAreaMetric] = useState<WarningAreaMetric>('warnings');

    const years = useMemo(() => {
        if (!warningSummary) return [];
        const currentYear = new Date().getFullYear();
        return warningSummary.annual.filter((row) => row.year < currentYear);
    }, [warningSummary]);

    const selectedTotals = useMemo(() => years
        .filter((row) => row.year >= startYear && row.year <= endYear)
        .reduce(addWarningRow, emptyWarningTotals()), [years, startYear, endYear]);

    const topWfos = useMemo(() => {
        if (!warningSummary) return [];
        const byWfo = new Map<string, WfoWarningYearSummary>();
        for (const row of warningSummary.wfoYear) {
            if (row.year < startYear || row.year > endYear) continue;
            const existing = byWfo.get(row.wfo) ?? { ...row, year: 0, warnings: 0, tornadoWarnings: 0, severeThunderstormWarnings: 0, emergencyWarnings: 0, matchedWarnings: 0, tornadoMatchedWarnings: 0, severeThunderstormMatchedWarnings: 0, warningAreaKm2: 0 };
            existing.warnings += row.warnings;
            existing.tornadoWarnings += row.tornadoWarnings;
            existing.severeThunderstormWarnings += row.severeThunderstormWarnings;
            existing.emergencyWarnings += row.emergencyWarnings;
            existing.matchedWarnings += row.matchedWarnings;
            existing.tornadoMatchedWarnings += row.tornadoMatchedWarnings;
            existing.severeThunderstormMatchedWarnings += row.severeThunderstormMatchedWarnings;
            existing.warningAreaKm2 += row.warningAreaKm2;
            byWfo.set(row.wfo, existing);
        }
        return [...byWfo.values()].sort((a, b) => b[areaMetric] - a[areaMetric]).slice(0, 10);
    }, [warningSummary, startYear, endYear, areaMetric]);

    const chartYears = years.filter((row) => row.warnings > 0);
    if (!warningSummary || years.length === 0 || chartYears.length === 0) return null;

    const W = 272; const H = 52;
    const maxWarnings = Math.max(1, ...chartYears.map((row) => row.warnings));
    const barW = W / chartYears.length;
    const firstYear = chartYears[0].year;
    const lastYear = chartYears[chartYears.length - 1].year;
    const maxWfoValue = Math.max(1, ...topWfos.map((row) => row[areaMetric]));

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-4 gap-1 text-[11px]">
                <div className="rounded bg-zinc-900 p-1.5">
                    <div className="text-[10px] text-zinc-500">Warnings</div>
                    <div className="font-semibold text-zinc-100">{selectedTotals.warnings.toLocaleString()}</div>
                </div>
                <div className="rounded bg-zinc-900 p-1.5">
                    <div className="text-[10px] text-zinc-500">Warn %</div>
                    <div className="font-semibold text-zinc-100">{percent(selectedTotals.matchedWarnings, selectedTotals.warnings)}%</div>
                </div>
                <div className="rounded bg-zinc-900 p-1.5">
                    <div className="text-[10px] text-zinc-500">Watches</div>
                    <div className="font-semibold text-zinc-100">{selectedTotals.watches.toLocaleString()}</div>
                </div>
                <div className="rounded bg-zinc-900 p-1.5">
                    <div className="text-[10px] text-zinc-500">Watch %</div>
                    <div className="font-semibold text-zinc-100">{percent(selectedTotals.matchedWatches, selectedTotals.watches)}%</div>
                </div>
            </div>

            <div>
                <div className="mb-1 flex items-center justify-between text-[10px] text-zinc-500">
                    <span>Storm-based warnings, {firstYear}-{lastYear}</span>
                    <span>{selectedTotals.tornadoWarnings.toLocaleString()} TOR warnings</span>
                </div>
                <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} aria-hidden="true">
                    {chartYears.map((row, i) => {
                        const h = Math.max(1, (row.warnings / maxWarnings) * H);
                        return (
                            <rect
                                key={row.year}
                                x={i * barW + 0.3}
                                y={H - h}
                                width={Math.max(0.5, barW - 0.6)}
                                height={h}
                                fill={row.year >= startYear && row.year <= endYear ? '#f97316' : '#3f3f46'}
                            />
                        );
                    })}
                </svg>
                <div className="flex justify-between text-[10px] text-zinc-600">
                    <span>{firstYear}</span><span>{lastYear}</span>
                </div>
            </div>

            <div>
                <div className="mb-2 flex flex-wrap gap-1 text-[10px]">
                    {(Object.keys(WARNING_AREA_METRIC_LABELS) as WarningAreaMetric[]).map((key) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setAreaMetric(key)}
                            className={`rounded px-1.5 py-0.5 ${areaMetric === key ? 'bg-zinc-500 text-zinc-950' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'}`}
                        >
                            {WARNING_AREA_METRIC_LABELS[key]}
                        </button>
                    ))}
                </div>
                <div className="space-y-1">
                    {topWfos.map((row) => {
                        const value = row[areaMetric];
                        const pct = (value / maxWfoValue) * 100;
                        return (
                            <div key={row.wfo} className="flex items-center gap-2 text-[11px]">
                                <span className="w-8 shrink-0 text-zinc-400">{row.wfo}</span>
                                <div className="relative h-3.5 min-w-0 flex-1 overflow-hidden rounded-sm bg-zinc-900">
                                    <div
                                        className="h-full rounded-sm bg-orange-400/75 transition-all duration-300"
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                                <span className="w-10 shrink-0 text-right text-zinc-300">{value.toLocaleString()}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Wrapper — renders all three in sequence
// ---------------------------------------------------------------------------

function TrendSnapshot({ annualSummary, warningSummary, startYear, endYear, stateBreakdown }: { annualSummary: AnnualTornadoSummary[]; warningSummary: WarningSummary | null; startYear: number; endYear: number; stateBreakdown: StateAggregateSummary[] }) {
    // Exclude the current in-progress year so partial data doesn't skew charts.
    // Use the actual max year in the summary rather than calling new Date() on
    // every render — the summary already stops at whatever NOAA has published.
    const fullHistory = useMemo(() => computeFullHistory(annualSummary), [annualSummary]);

    return (
        <section className="space-y-5 border-t border-zinc-800 pt-4">
            <div>
                <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">A · Annual count vs selection</div>
                <TrendSparkline allYears={fullHistory} startYear={startYear} endYear={endYear} />
            </div>
            <div>
                <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">B · Frequency vs fatality rate</div>
                <TrendDualMetric allYears={fullHistory} startYear={startYear} endYear={endYear} />
            </div>
            <div>
                <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">C · Decade comparison</div>
                <TrendDecadeTable allYears={fullHistory} />
            </div>
            {stateBreakdown.length > 0 && (
                <div>
                    <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">D · Top states</div>
                    <TrendByState stateBreakdown={stateBreakdown} />
                </div>
            )}
            {warningSummary && (
                <div>
                    <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">E · Warnings and watches</div>
                    <TrendWarnings warningSummary={warningSummary} startYear={startYear} endYear={endYear} />
                </div>
            )}
        </section>
    );
}

export function TornadoSummaryPanel({
    stats,
    stateBreakdown,
    selectedTrack,
    notableEvents,
    annualSummary,
    warningSummary,
    startYear,
    endYear,
    scaleFilter,
    region,
    colorMode,
    mode,
    selectedState,
    selectedStateName,
    shareCopied,
    collapsed = false,
    onCollapseChange,
    onScaleFilterChange,
    onRegionChange,
    onSelectedStateChange,
    onColorModeChange,
    onModeChange,
    onSelectEvent,
    onShare,
    onCloseSelection,
}: TornadoSummaryPanelProps) {
    const selected = selectedTrack?.properties;

    return (
        <aside className="absolute right-3 top-20 z-20 hidden max-h-[calc(100dvh-220px)] w-80 overflow-y-auto rounded-lg border border-zinc-700/80 bg-zinc-950/90 text-sm text-zinc-300 shadow-2xl backdrop-blur-md md:block">
            <div className="flex items-start justify-between gap-3 p-4">
                <div>
                    <div className="text-xs uppercase tracking-wide text-zinc-500">Tornado Tracks</div>
                    <h2 className="text-lg font-semibold text-zinc-100">{stats.count.toLocaleString()} tracks</h2>
                    {selectedState && (
                        <div className="mt-0.5 text-xs text-sky-300">{selectedStateName ?? selectedState}</div>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={onShare}
                        className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                        title="Copy current map link"
                    >
                        {shareCopied ? 'Copied' : 'Share'}
                    </button>
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

                        {selectedState && (
                            <div className="flex items-center justify-between gap-2 rounded-md border border-sky-500/40 bg-sky-950/30 px-2.5 py-2 text-xs">
                                <span className="text-sky-200">{selectedStateName ?? selectedState}</span>
                                <button
                                    type="button"
                                    onClick={() => onSelectedStateChange(null)}
                                    className="rounded px-2 py-1 text-sky-200 hover:bg-sky-900/60"
                                >
                                    Clear
                                </button>
                            </div>
                        )}

                        <div>
                            <div className="mb-1.5 text-xs uppercase tracking-wide text-zinc-500">Color</div>
                            <div className="grid grid-cols-3 gap-1 text-xs">
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
                        {colorMode === 'year' ? (
                            <>
                                <div
                                    className="mb-1.5 h-3 w-full rounded-full"
                                    style={{ background: `linear-gradient(to right, ${YEAR_COLOR_STOPS.map(s => s.color).join(', ')})` }}
                                />
                                <div className="flex justify-between text-xs text-zinc-500">
                                    <span>{YEAR_COLOR_STOPS[0].year}</span>
                                    <span>{YEAR_COLOR_STOPS[YEAR_COLOR_STOPS.length - 1].year}</span>
                                </div>
                            </>
                        ) : colorMode === 'decade' ? (
                            <div className="grid grid-cols-2 gap-1.5 text-xs">
                                {(Object.entries(DECADE_COLORS) as [string, string][]).map(([decade, color]) => (
                                    <div key={decade} className="flex items-center gap-2">
                                        <span className="h-2.5 w-5 rounded-full" style={{ backgroundColor: color }} />
                                        <span className="text-zinc-400">{decade}s</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-1.5 text-xs">
                                {[-1, 0, 1, 2, 3, 4, 5].map((scale) => (
                                    <div key={scale} className="flex items-center gap-2">
                                        <span className="h-2.5 w-5 rounded-full" style={{ backgroundColor: SCALE_COLORS[scale] }} />
                                        <span className="text-zinc-400">{SCALE_LABELS[scale]}</span>
                                    </div>
                                ))}
                            </div>
                        )}
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
                        <TrendSnapshot annualSummary={annualSummary} warningSummary={warningSummary} startYear={startYear} endYear={endYear} stateBreakdown={stateBreakdown} />
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