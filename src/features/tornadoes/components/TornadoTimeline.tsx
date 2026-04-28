import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AnnualTornadoSummary } from '../types';

interface TornadoTimelineProps {
    annualSummary: AnnualTornadoSummary[];
    startYear: number;
    endYear: number;
    minYear: number;
    maxYear: number;
    onYearRangeChange: (startYear: number, endYear: number) => void;
    onPlayingChange?: (playing: boolean) => void;
    collapsed?: boolean;
    onCollapseChange?: (collapsed: boolean) => void;
}

export function TornadoTimeline({
    annualSummary,
    startYear,
    endYear,
    minYear,
    maxYear,
    onYearRangeChange,
    onPlayingChange,
    collapsed = false,
    onCollapseChange,
}: TornadoTimelineProps) {
    const [playing, setPlaying] = useState(false);
    const maxCount = useMemo(
        () => Math.max(1, ...annualSummary.map((summary) => summary.count)),
        [annualSummary],
    );

    const togglePlaying = useCallback(() => {
        const next = !playing;
        setPlaying(next);
        onPlayingChange?.(next);
    }, [playing, onPlayingChange]);

    useEffect(() => {
        if (!playing) return;
        const id = window.setInterval(() => {
            const nextYear = endYear >= maxYear ? minYear : endYear + 1;
            onYearRangeChange(nextYear, nextYear);
        }, 850);
        return () => window.clearInterval(id);
    }, [playing, endYear, minYear, maxYear, onYearRangeChange]);

    const setStart = (value: number) => onYearRangeChange(Math.min(value, endYear), endYear);
    const setEnd = (value: number) => onYearRangeChange(startYear, Math.max(value, startYear));
    const selectedCount = annualSummary
        .filter((summary) => summary.year >= startYear && summary.year <= endYear)
        .reduce((sum, summary) => sum + summary.count, 0);

    return (
        <div className="absolute inset-x-3 bottom-3 z-20 rounded-lg border border-zinc-700/80 bg-zinc-950/90 backdrop-blur-md shadow-2xl md:inset-x-6">
            <div className="flex flex-col gap-3 p-3 md:p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="text-xs uppercase tracking-wide text-zinc-500">Timeline</div>
                        <div className="text-sm font-medium text-zinc-100">
                            {startYear === endYear ? startYear : `${startYear}-${endYear}`}
                            <span className="ml-2 text-xs font-normal text-zinc-400">{selectedCount.toLocaleString()} tracks</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        <button
                            type="button"
                            onClick={() => onYearRangeChange(Math.max(minYear, startYear - 1), Math.max(minYear, endYear - 1))}
                            className="h-8 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 text-zinc-200 hover:bg-zinc-800"
                        >
                            Prev
                        </button>
                        <button
                            type="button"
                            onClick={togglePlaying}
                            className="h-8 min-w-16 rounded-md bg-sky-500 px-3 font-medium text-zinc-950 hover:bg-sky-400"
                        >
                            {playing ? 'Pause' : 'Play'}
                        </button>
                        <button
                            type="button"
                            onClick={() => onYearRangeChange(Math.min(maxYear, startYear + 1), Math.min(maxYear, endYear + 1))}
                            className="h-8 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 text-zinc-200 hover:bg-zinc-800"
                        >
                            Next
                        </button>
                        {onCollapseChange && (
                            <button
                                type="button"
                                onClick={() => onCollapseChange(!collapsed)}
                                className="h-8 w-8 rounded-md border border-zinc-700 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                                aria-label={collapsed ? 'Expand timeline' : 'Collapse timeline'}
                            >
                                {collapsed ? '▲' : '▼'}
                            </button>
                        )}
                    </div>
                </div>

                {!collapsed && (
                    <>
                        <div className="grid h-20 grid-cols-[repeat(auto-fit,minmax(3px,1fr))] items-end gap-px rounded bg-zinc-900/80 p-2" aria-hidden="true">
                            {annualSummary.map((summary) => {
                                const active = summary.year >= startYear && summary.year <= endYear;
                                return (
                                    <button
                                        key={summary.year}
                                        type="button"
                                        title={`${summary.year}: ${summary.count.toLocaleString()} tornadoes`}
                                        onClick={() => onYearRangeChange(summary.year, summary.year)}
                                        className={`min-h-1 rounded-sm ${active ? 'bg-sky-300' : 'bg-zinc-600 hover:bg-zinc-400'}`}
                                        style={{ height: `${Math.max(4, (summary.count / maxCount) * 100)}%` }}
                                    />
                                );
                            })}
                        </div>

                        <div className="grid gap-2 md:grid-cols-2">
                            <label className="grid gap-1 text-xs text-zinc-400">
                                <span>Start {startYear}</span>
                                <input
                                    type="range"
                                    min={minYear}
                                    max={maxYear}
                                    value={startYear}
                                    onChange={(event) => setStart(Number(event.target.value))}
                                    className="accent-sky-400"
                                />
                            </label>
                            <label className="grid gap-1 text-xs text-zinc-400">
                                <span>End {endYear}</span>
                                <input
                                    type="range"
                                    min={minYear}
                                    max={maxYear}
                                    value={endYear}
                                    onChange={(event) => setEnd(Number(event.target.value))}
                                    className="accent-sky-400"
                                />
                            </label>
                        </div>

                        <div className="flex flex-wrap gap-2 text-xs">
                            <button type="button" onClick={() => onYearRangeChange(minYear, maxYear)} className="rounded-md bg-zinc-800 px-2.5 py-1.5 text-zinc-200 hover:bg-zinc-700">All</button>
                            <button type="button" onClick={() => onYearRangeChange(1950, Math.min(1979, maxYear))} className="rounded-md bg-zinc-800 px-2.5 py-1.5 text-zinc-200 hover:bg-zinc-700">1950-1979</button>
                            <button type="button" onClick={() => onYearRangeChange(1980, Math.min(1999, maxYear))} className="rounded-md bg-zinc-800 px-2.5 py-1.5 text-zinc-200 hover:bg-zinc-700">1980-1999</button>
                            <button type="button" onClick={() => onYearRangeChange(Math.min(2000, maxYear), maxYear)} className="rounded-md bg-zinc-800 px-2.5 py-1.5 text-zinc-200 hover:bg-zinc-700">2000+</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}