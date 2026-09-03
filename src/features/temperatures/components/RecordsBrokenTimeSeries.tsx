import { useState } from 'react';
import type { YearData, HighlightRange } from '../types';
import { HIGH_TEMP_COLOR, LOW_TEMP_COLOR } from '../constants';
import { ChartEmptyState } from './ChartEmptyState';

interface Props {
    data: YearData[];
    onHoverPeriod?: (range: HighlightRange | null) => void;
    selectedDecade?: number | null;
    onSelectDecade?: (decade: number | null) => void;
    compact?: boolean;
}

/**
 * Area chart grouping today's standing county highs and lows by the year set.
 */
export function RecordsBrokenTimeSeries({ data, onHoverPeriod, selectedDecade, onSelectDecade, compact }: Props) {
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

    // Compute 5-year rolling averages for smoother visualization
    const rolling = data.map((d, i) => {
        const windowSize = 5;
        const start = Math.max(0, i - windowSize + 1);
        const window = data.slice(start, i + 1);
        return {
            year: d.year,
            highs: d.highs,
            lows: d.lows,
            highsAvg: window.reduce((s, w) => s + w.highs, 0) / window.length,
            lowsAvg: window.reduce((s, w) => s + w.lows, 0) / window.length,
        };
    });

    const filtered = rolling.filter(d => d.year >= 1900);
    if (filtered.length === 0) {
        return <ChartEmptyState message="No annual all-time county record data is available for this selection." />;
    }

    const maxAvg = Math.max(...filtered.flatMap(d => [d.highsAvg, d.lowsAvg]), 1);

    const padding = { top: 20, right: 20, bottom: 30, left: 36 };
    const width = 700;
    const height = 260;
    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;

    const firstYear = filtered[0].year;
    const lastYear = filtered[filtered.length - 1].year;
    const yearSpan = Math.max(1, lastYear - firstYear);
    const xScale = (year: number) => padding.left + ((year - firstYear) / yearSpan) * plotW;
    const yScale = (val: number) => padding.top + plotH - (val / maxAvg) * plotH;

    const buildPath = (key: 'highsAvg' | 'lowsAvg') => {
        return filtered
            .map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(d.year).toFixed(1)},${yScale(d[key]).toFixed(1)}`)
            .join(' ');
    };

    const buildAreaPath = (key: 'highsAvg' | 'lowsAvg') => {
        const line = filtered.map(d => `${xScale(d.year).toFixed(1)},${yScale(d[key]).toFixed(1)}`);
        const baseline = `${xScale(filtered[filtered.length - 1].year).toFixed(1)},${yScale(0).toFixed(1)} ${xScale(filtered[0].year).toFixed(1)},${yScale(0).toFixed(1)}`;
        return `M${line.join(' L')} L${baseline} Z`;
    };

    // Year ticks
    const yearTicks = filtered.filter(d => d.year % 20 === 0);

    // Y-axis ticks
    const yTicks = Array.from(new Set(Array.from({ length: 5 }, (_, i) => Math.round((maxAvg / 4) * i))));

    const hoveredData = hoveredIdx !== null ? filtered[hoveredIdx] : null;

    return (
        <div className={compact ? 'flex flex-col h-full' : ''}>
            {!compact && (
                <>
                    <h3 className="text-sm font-semibold text-zinc-200 mb-1">Standing County Records by Year Set</h3>
                    <p className="text-xs text-zinc-400 mb-4">
                        Current county extremes grouped by the year they occurred, shown as a 5-calendar-year rolling average.
                        Records that were later superseded are not included.
                    </p>
                </>
            )}
            <div className={compact ? 'flex-1 min-h-0' : 'overflow-x-auto'}>
                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className={compact ? 'w-full h-full' : 'w-full min-w-[500px]'}
                    preserveAspectRatio={compact ? 'xMidYMid meet' : undefined}
                    role="img"
                    aria-label="Standing county records grouped by year set"
                    onMouseLeave={() => { setHoveredIdx(null); onHoverPeriod?.(null); }}
                >
                    <desc>Area chart grouping today's standing county record highs and lows by the year they occurred, with a five-calendar-year rolling average.</desc>
                    {/* Grid lines */}
                    {yTicks.map(v => (
                        <g key={v}>
                            <line
                                x1={padding.left} y1={yScale(v)} x2={width - padding.right} y2={yScale(v)}
                                stroke="#27272a" strokeWidth={1}
                            />
                            <text x={padding.left - 4} y={yScale(v) + 3} fill="#a1a1aa" fontSize={9} textAnchor="end">
                                {v}
                            </text>
                        </g>
                    ))}

                    {/* X-axis ticks */}
                    {yearTicks.map(d => (
                        <text key={d.year} x={xScale(d.year)} y={height - 4} fill="#a1a1aa" fontSize={9} textAnchor="middle">
                            {d.year}
                        </text>
                    ))}

                    {/* Selected decade highlight band */}
                    {selectedDecade != null && (() => {
                        const x1 = xScale(Math.max(selectedDecade, filtered[0].year));
                        const x2 = xScale(Math.min(selectedDecade + 9, filtered[filtered.length - 1].year));
                        return (
                            <rect
                                x={x1} y={padding.top} width={Math.max(0, x2 - x1)} height={plotH}
                                fill="#a78bfa" opacity={0.1} rx={2}
                                style={{ pointerEvents: 'none' }}
                            />
                        );
                    })()}

                    {/* Area fills */}
                    <path d={buildAreaPath('highsAvg')} fill={HIGH_TEMP_COLOR} opacity={0.12} />
                    <path d={buildAreaPath('lowsAvg')} fill={LOW_TEMP_COLOR} opacity={0.12} />

                    {/* Lines */}
                    <path d={buildPath('highsAvg')} fill="none" stroke={HIGH_TEMP_COLOR} strokeWidth={2} opacity={0.9} />
                    <path d={buildPath('lowsAvg')} fill="none" stroke={LOW_TEMP_COLOR} strokeWidth={2} opacity={0.9} />

                    {/* Hover interaction */}
                    {filtered.map((d, i) => (
                        <rect
                            key={d.year}
                            x={xScale(d.year) - plotW / filtered.length / 2}
                            y={padding.top}
                            width={plotW / filtered.length}
                            height={plotH}
                            fill="transparent"
                            onMouseEnter={() => { setHoveredIdx(i); onHoverPeriod?.({ startYear: d.year, endYear: d.year }); }}
                            onClick={() => {
                                const decade = Math.floor(d.year / 10) * 10;
                                onSelectDecade?.(selectedDecade === decade ? null : decade);
                            }}
                            style={{ cursor: 'pointer' }}
                        />
                    ))}

                    {/* Hover indicator */}
                    {hoveredData && (
                        <>
                            <line
                                x1={xScale(hoveredData.year)} y1={padding.top}
                                x2={xScale(hoveredData.year)} y2={padding.top + plotH}
                                stroke="#a1a1aa" strokeWidth={1} strokeDasharray="3,3"
                            />
                            <circle cx={xScale(hoveredData.year)} cy={yScale(hoveredData.highsAvg)} r={4}
                                fill={HIGH_TEMP_COLOR} stroke="#18181b" strokeWidth={2} />
                            <circle cx={xScale(hoveredData.year)} cy={yScale(hoveredData.lowsAvg)} r={4}
                                fill={LOW_TEMP_COLOR} stroke="#18181b" strokeWidth={2} />
                        </>
                    )}

                    {/* Legend */}
                    <line x1={width - 150} y1={12} x2={width - 134} y2={12} stroke={HIGH_TEMP_COLOR} strokeWidth={2} />
                    <text x={width - 130} y={15} fill="#fca5a5" fontSize={10}>Record Highs</text>
                    <line x1={width - 150} y1={26} x2={width - 134} y2={26} stroke={LOW_TEMP_COLOR} strokeWidth={2} />
                    <text x={width - 130} y={29} fill="#93c5fd" fontSize={10}>Record Lows</text>
                </svg>
            </div>
            {/* Tooltip */}
            {hoveredData && (
                <div className={`text-xs text-zinc-400 ${compact ? 'shrink-0 px-1 py-0.5' : 'mt-1'}`}>
                    <span className="text-zinc-200 font-medium">{hoveredData.year}</span>
                    {' — '}
                    <span style={{ color: '#fca5a5' }}>{hoveredData.highs} highs</span>
                    {', '}
                    <span style={{ color: '#93c5fd' }}>{hoveredData.lows} lows</span>
                    <span className="text-zinc-400">
                        {' '}(5yr avg: {hoveredData.highsAvg.toFixed(1)}h / {hoveredData.lowsAvg.toFixed(1)}l)
                    </span>
                </div>
            )}
            {!compact && <p className="text-[10px] text-zinc-500 mt-2">This survivor distribution should not be interpreted as the annual frequency of record-breaking events.</p>}
        </div>
    );
}
