import { useCallback, useEffect, useMemo, useState } from 'react';
import { DECADE_COLORS } from '../constants';
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
    const [stride, setStride] = useState<1 | 10>(1);
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
        const delay = stride === 10 ? 2000 : 850;
        const id = window.setInterval(() => {
            if (stride === 10) {
                const decadeFloor = Math.floor(endYear / 10) * 10;
                const nextStart = decadeFloor + 10 > maxYear
                    ? Math.floor(minYear / 10) * 10
                    : decadeFloor + 10;
                onYearRangeChange(nextStart, Math.min(nextStart + 9, maxYear));
            } else {
                const nextYear = endYear >= maxYear ? minYear : endYear + 1;
                onYearRangeChange(nextYear, nextYear);
            }
        }, delay);
        return () => window.clearInterval(id);
    }, [playing, stride, endYear, minYear, maxYear, onYearRangeChange]);

    const stepBack = useCallback(() => {
        if (stride === 10) {
            const decadeFloor = Math.floor(startYear / 10) * 10;
            const prevStart = Math.max(Math.floor(minYear / 10) * 10, decadeFloor - 10);
            onYearRangeChange(prevStart, Math.min(prevStart + 9, maxYear));
        } else {
            onYearRangeChange(Math.max(minYear, startYear - 1), Math.max(minYear, endYear - 1));
        }
    }, [stride, startYear, endYear, minYear, maxYear, onYearRangeChange]);

    const stepForward = useCallback(() => {
        if (stride === 10) {
            const decadeFloor = Math.floor(startYear / 10) * 10;
            const nextStart = decadeFloor + 10;
            if (nextStart > maxYear) {
                // Wrap to first decade
                const firstDecade = Math.floor(minYear / 10) * 10;
                onYearRangeChange(firstDecade, Math.min(firstDecade + 9, maxYear));
            } else {
                onYearRangeChange(nextStart, Math.min(nextStart + 9, maxYear));
            }
        } else {
            onYearRangeChange(Math.min(maxYear, startYear + 1), Math.min(maxYear, endYear + 1));
        }
    }, [stride, startYear, endYear, minYear, maxYear, onYearRangeChange]);

    const setStart = useCallback(
        (value: number) => onYearRangeChange(Math.min(value, endYear), endYear),
        [onYearRangeChange, endYear],
    );
    const setEnd = useCallback(
        (value: number) => onYearRangeChange(startYear, Math.max(value, startYear)),
        [onYearRangeChange, startYear],
    );
    const selectedCount = useMemo(
        () => annualSummary
            .filter((summary) => summary.year >= startYear && summary.year <= endYear)
            .reduce((sum, summary) => sum + summary.count, 0),
        [annualSummary, startYear, endYear],
    );

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
                            onClick={stepBack}
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
                            onClick={stepForward}
                            className="h-8 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 text-zinc-200 hover:bg-zinc-800"
                        >
                            Next
                        </button>
                        {/* Stride toggle */}
                        <div className="flex h-8 overflow-hidden rounded-md border border-zinc-700 text-[11px]">
                            <button
                                type="button"
                                onClick={() => setStride(1)}
                                className={`px-2 ${stride === 1 ? 'bg-zinc-500 text-zinc-950 font-semibold' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'}`}
                            >
                                1yr
                            </button>
                            <button
                                type="button"
                                onClick={() => setStride(10)}
                                className={`px-2 ${stride === 10 ? 'bg-zinc-500 text-zinc-950 font-semibold' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'}`}
                            >
                                10yr
                            </button>
                        </div>
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
                                const barDecade = Math.floor(summary.year / 10) * 10;
                                const decadeColor = DECADE_COLORS[barDecade] ?? '#38bdf8';
                                return (
                                    <button
                                        key={summary.year}
                                        type="button"
                                        title={`${summary.year}: ${summary.count.toLocaleString()} tornadoes`}
                                        onClick={() => onYearRangeChange(summary.year, summary.year)}
                                        className="min-h-1 rounded-sm"
                                        style={{
                                            height: `${Math.max(4, (summary.count / maxCount) * 100)}%`,
                                            backgroundColor: active
                                                ? (stride === 10 ? decadeColor : '#7dd3fc')
                                                : '#3f3f46',
                                        }}
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

                        <div className="flex flex-wrap gap-1.5 text-xs">
                            {/* All-time shortcut */}
                            <button
                                type="button"
                                onClick={() => onYearRangeChange(minYear, maxYear)}
                                className={`rounded-md px-2 py-1 ${startYear === minYear && endYear === maxYear
                                    ? 'bg-zinc-400 text-zinc-950'
                                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                    }`}
                            >
                                All
                            </button>
                            {/* One button per decade */}
                            {(Object.entries(DECADE_COLORS) as [string, string][]).map(([decadeStr, color]) => {
                                const decade = Number(decadeStr);
                                const decadeEnd = Math.min(decade + 9, maxYear);
                                if (decade > maxYear) return null;
                                const isActive = startYear === decade && endYear === decadeEnd;
                                return (
                                    <button
                                        key={decade}
                                        type="button"
                                        onClick={() => {
                                            setStride(10);
                                            onYearRangeChange(decade, decadeEnd);
                                        }}
                                        style={isActive ? { backgroundColor: color, color: '#09090b' } : {}}
                                        className={`rounded-md px-2 py-1 ${isActive
                                            ? 'font-semibold'
                                            : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                            }`}
                                    >
                                        {decade}s
                                    </button>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}