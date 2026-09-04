import { useState } from 'react';
import type { DecadeData, RollingRatioData, HighlightRange } from '../types';
import { HIGH_TEMP_COLOR, yearToColor } from '../constants';
import { ChartEmptyState } from './ChartEmptyState';

interface Props {
    decadeData: DecadeData[];
    rollingData: RollingRatioData[];
    onHoverPeriod?: (range: HighlightRange | null) => void;
    selectedDecade?: number | null;
    onSelectDecade?: (decade: number | null) => void;
    compact?: boolean;
}

type View = 'decade' | 'rolling';

/**
 * Ratio of today's standing county highs to lows grouped by record date.
 */
export function HighLowRatioChart({ decadeData, rollingData, onHoverPeriod, selectedDecade, onSelectDecade, compact }: Props) {
    const [view, setView] = useState<View>('decade');
    const [hovered, setHovered] = useState<number | null>(null);

    if (view === 'decade') {
        return (
            <DecadeRatioView
                data={decadeData}
                hovered={hovered}
                setHovered={setHovered}
                selectedDecade={selectedDecade}
                onSelectDecade={onSelectDecade}
                onSwitchView={() => setView('rolling')}
                onHoverPeriod={onHoverPeriod}
                compact={compact}
            />
        );
    }

    return (
        <RollingRatioView
            data={rollingData}
            hovered={hovered}
            setHovered={setHovered}
            onSwitchView={() => setView('decade')}
            onHoverPeriod={onHoverPeriod}
            compact={compact}
        />
    );
}

function DecadeRatioView({ data, hovered, setHovered, selectedDecade, onSelectDecade, onSwitchView, onHoverPeriod, compact }: {
    data: DecadeData[];
    hovered: number | null;
    setHovered: (i: number | null) => void;
    selectedDecade?: number | null;
    onSelectDecade?: (decade: number | null) => void;
    onSwitchView: () => void;
    onHoverPeriod?: (range: HighlightRange | null) => void;
    compact?: boolean;
}) {
    const [localSelected, setLocalSelected] = useState<number | null>(null);
    const filtered = data.filter(d => d.decade >= 1900 && d.ratio !== null);
    if (filtered.length === 0) {
        return <ChartEmptyState message="No high-to-low ratio data is available for this selection." />;
    }

    const maxRatio = Math.max(...filtered.map(d => d.ratio!), 2);

    const selectedIdx = selectedDecade !== undefined
        ? filtered.findIndex(d => d.decade === selectedDecade)
        : localSelected;
    const selected = selectedIdx === -1 ? null : selectedIdx;
    const setSelected = (idx: number | null) => {
        const decade = idx !== null ? filtered[idx]?.decade ?? null : null;
        if (onSelectDecade) onSelectDecade(decade);
        else setLocalSelected(idx);
    };
    const restoreSelectedRange = () => {
        setHovered(null);
        const selectedData = selected === null ? null : filtered[selected];
        onHoverPeriod?.(selectedData
            ? { startYear: selectedData.decade, endYear: selectedData.decade + 9 }
            : null);
    };
    const activeIndex = hovered ?? selected;
    const activeData = activeIndex === null ? null : filtered[activeIndex];

    const barWidth = 46;
    const gap = 8;
    const chartWidth = filtered.length * (barWidth + gap) - gap;
    const chartHeight = 200;
    const padding = { top: 20, bottom: 30, left: 40, right: 10 };
    const plotH = chartHeight - padding.top - padding.bottom;
    const width = chartWidth + padding.left + padding.right;

    const yScale = (val: number) => padding.top + plotH - (val / maxRatio) * plotH;
    const equilibriumY = yScale(1);

    return (
        <div className={compact ? 'flex flex-col h-full' : ''}>
            {compact ? (
                <div className="flex items-center justify-end shrink-0 mb-0.5">
                    <button onClick={onSwitchView} className="text-[10px] text-violet-400 hover:text-violet-300 transition-colors">
                        Show rolling →
                    </button>
                </div>
            ) : (
                <>
                    <div className="flex items-baseline gap-3 mb-1">
                        <h3 className="text-sm font-semibold text-zinc-200">High:Low Ratio by Decade</h3>
                        <button onClick={onSwitchView} className="text-[10px] text-violet-400 hover:text-violet-300 transition-colors">
                            Show rolling →
                        </button>
                    </div>
                    <p className="text-xs text-zinc-400 mb-4">
                        Ratio of today&apos;s standing county highs to lows grouped by the decade they occurred.
                        A value of 1.0 means equal counts; superseded records are not included.
                    </p>
                </>
            )}
            <div className={compact ? 'flex-1 min-h-0' : 'overflow-x-auto'}>
                <svg
                    viewBox={`0 0 ${width} ${chartHeight}`}
                    className={compact ? 'w-full h-full' : 'w-full min-w-[400px]'}
                    preserveAspectRatio={compact ? 'xMidYMid meet' : undefined}
                    role="img"
                    aria-label="High to low ratio by decade"
                    onClick={() => { setSelected(null); onHoverPeriod?.(null); }}
                    onMouseLeave={restoreSelectedRange}
                >
                    <desc>Bar chart showing the ratio of today's standing county record highs to lows grouped by record decade. A dashed line marks equal counts.</desc>
                    {/* Equilibrium line at 1:1 */}
                    <line
                        x1={padding.left} y1={equilibriumY} x2={width - padding.right} y2={equilibriumY}
                        stroke="#a1a1aa" strokeWidth={1} strokeDasharray="4,4"
                    />
                    <text x={padding.left - 4} y={equilibriumY + 3} fill="#a1a1aa" fontSize={9} textAnchor="end" fontWeight={600}>
                        1:1
                    </text>

                    {/* Y-axis */}
                    {[0, 2, 4].filter(v => v <= maxRatio).map(v => (
                        <g key={v}>
                            <line x1={padding.left} y1={yScale(v)} x2={width - padding.right} y2={yScale(v)}
                                stroke="#27272a" strokeWidth={1} />
                            <text x={padding.left - 4} y={yScale(v) + 3} fill="#a1a1aa" fontSize={9} textAnchor="end">
                                {v}
                            </text>
                        </g>
                    ))}

                    {filtered.map((d, i) => {
                        const x = padding.left + i * (barWidth + gap);
                        const ratio = d.ratio!;
                        const barH = (ratio / maxRatio) * plotH;
                        const isActive = activeIndex === i;
                        const opacity = activeIndex === null || isActive ? 1 : 0.4;
                        const color = yearToColor(d.decade);

                        return (
                            <g
                                key={d.decade}
                                role="button"
                                tabIndex={0}
                                aria-pressed={selected === i}
                                aria-label={`${d.label}: ${ratio.toFixed(2)} standing highs per standing low`}
                                onMouseEnter={() => {
                                    setHovered(i);
                                    onHoverPeriod?.({ startYear: d.decade, endYear: d.decade + 9 });
                                }}
                                onFocus={() => {
                                    setHovered(i);
                                    onHoverPeriod?.({ startYear: d.decade, endYear: d.decade + 9 });
                                }}
                                onBlur={restoreSelectedRange}
                                onKeyDown={(event) => {
                                    if (event.key !== 'Enter' && event.key !== ' ') return;
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setSelected(selected === i ? null : i);
                                }}
                                onMouseLeave={restoreSelectedRange}
                                onClick={(e) => { e.stopPropagation(); setSelected(selected === i ? null : i); }}
                                style={{ cursor: 'pointer' }}
                            >
                                {/* Selected indicator */}
                                {isActive && (
                                    <rect
                                        x={x - 3} y={padding.top + plotH - barH - 3}
                                        width={barWidth + 6} height={barH + 6}
                                        fill="none" stroke={selected === i ? '#a78bfa' : '#f4f4f5'} strokeWidth={1.5}
                                        rx={4} strokeDasharray={selected === i ? '4 2' : undefined}
                                    />
                                )}
                                <rect
                                    x={x} y={padding.top + plotH - barH}
                                    width={barWidth} height={barH}
                                    fill={color} opacity={opacity * 0.85}
                                    rx={2}
                                />
                                <text x={x + barWidth / 2} y={chartHeight - 4}
                                    fill="#a1a1aa" fontSize={10} textAnchor="middle">
                                    {d.label}
                                </text>
                                {isActive && (
                                    <text x={x + barWidth / 2} y={padding.top + plotH - barH - 6}
                                        fill="#e4e4e7" fontSize={11} fontWeight={600} textAnchor="middle">
                                        {ratio.toFixed(1)}:1
                                    </text>
                                )}
                            </g>
                        );
                    })}
                </svg>
            </div>
            {activeData && (
                <p
                    aria-live="polite"
                    aria-label={`${activeData.label}: ${activeData.highs} highs / ${activeData.lows} lows = ${activeData.ratio?.toFixed(2)} : 1`}
                    className={`text-xs text-zinc-400 ${compact ? 'shrink-0 px-1 py-0.5' : 'mt-1'}`}
                >
                    <span className="font-medium text-zinc-200">{activeData.label}</span>
                    {' — '}
                    <span style={{ color: '#fca5a5' }}>{activeData.highs} highs</span>
                    {' / '}
                    <span style={{ color: '#93c5fd' }}>{activeData.lows} lows</span>
                    {' = '}
                    <span className="font-medium text-zinc-200">{activeData.ratio?.toFixed(2)} : 1</span>
                </p>
            )}
            {!compact && (
                <p className="text-[10px] text-zinc-500 mt-2">
                    The dashed line marks equal surviving high and low counts. Values above it mean more of today&apos;s highs than lows were set in that decade.
                </p>
            )}
        </div>
    );
}

function RollingRatioView({ data, hovered, setHovered, onSwitchView, onHoverPeriod, compact }: {
    data: RollingRatioData[];
    hovered: number | null;
    setHovered: (i: number | null) => void;
    onSwitchView: () => void;
    onHoverPeriod?: (range: HighlightRange | null) => void;
    compact?: boolean;
}) {
    const filtered = data.filter(d => d.year >= 1910 && d.ratio !== null);
    if (filtered.length === 0) {
        return <ChartEmptyState message="No rolling high-to-low ratio data is available for this selection." />;
    }

    const maxRatio = Math.min(Math.max(...filtered.map(d => d.ratio!), 3), 10);

    const padding = { top: 20, right: 20, bottom: 30, left: 36 };
    const width = 700;
    const height = 240;
    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;

    const firstYear = filtered[0].year;
    const lastYear = filtered[filtered.length - 1].year;
    const yearSpan = Math.max(1, lastYear - firstYear);
    const xScale = (year: number) => padding.left + ((year - firstYear) / yearSpan) * plotW;
    const yScale = (val: number) => padding.top + plotH - (Math.min(val, maxRatio) / maxRatio) * plotH;

    const path = filtered
        .map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(d.year).toFixed(1)},${yScale(d.ratio!).toFixed(1)}`)
        .join(' ');

    const areaPath = (() => {
        const line = filtered.map(d => `${xScale(d.year).toFixed(1)},${yScale(d.ratio!).toFixed(1)}`);
        const baseline = `${xScale(filtered[filtered.length - 1].year).toFixed(1)},${yScale(0).toFixed(1)} ${xScale(filtered[0].year).toFixed(1)},${yScale(0).toFixed(1)}`;
        return `M${line.join(' L')} L${baseline} Z`;
    })();

    const yearTicks = filtered.filter(d => d.year % 20 === 0);
    const equilibriumY = yScale(1);
    const hoveredData = hovered !== null && hovered < filtered.length ? filtered[hovered] : null;

    return (
        <div className={compact ? 'flex flex-col h-full' : ''}>
            {compact ? (
                <div className="flex items-center justify-end shrink-0 mb-0.5">
                    <button onClick={onSwitchView} className="text-[10px] text-violet-400 hover:text-violet-300 transition-colors">
                        ← Show decades
                    </button>
                </div>
            ) : (
                <>
                    <div className="flex items-baseline gap-3 mb-1">
                        <h3 className="text-sm font-semibold text-zinc-200">Rolling 10-Year H:L Ratio</h3>
                        <button onClick={onSwitchView} className="text-[10px] text-violet-400 hover:text-violet-300 transition-colors">
                            ← Show decades
                        </button>
                    </div>
                    <p className="text-xs text-zinc-400 mb-4">Ten-calendar-year rolling ratio of today&apos;s standing county highs to lows, grouped by record date.</p>
                </>
            )}
            <div className={compact ? 'flex-1 min-h-0' : 'overflow-x-auto'}>
                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className={compact ? 'w-full h-full' : 'w-full min-w-[500px]'}
                    preserveAspectRatio={compact ? 'xMidYMid meet' : undefined}
                    role="img"
                    aria-label="Rolling 10-year high to low ratio"
                    onMouseLeave={() => { setHovered(null); onHoverPeriod?.(null); }}
                >
                    <desc>Line chart showing the rolling 10-year ratio of record highs to record lows from 1910 to present. Values above 1:1 indicate more highs than lows.</desc>
                    {/* Equilibrium */}
                    <line x1={padding.left} y1={equilibriumY} x2={width - padding.right} y2={equilibriumY}
                        stroke="#a1a1aa" strokeWidth={1} strokeDasharray="4,4" />
                    <text x={padding.left - 4} y={equilibriumY + 3} fill="#a1a1aa" fontSize={9} textAnchor="end">1:1</text>

                    {/* Grid */}
                    {[0, 2, 4, 6, 8].filter(v => v <= maxRatio).map(v => (
                        <g key={v}>
                            <line x1={padding.left} y1={yScale(v)} x2={width - padding.right} y2={yScale(v)}
                                stroke="#27272a" strokeWidth={1} />
                            <text x={padding.left - 4} y={yScale(v) + 3} fill="#a1a1aa" fontSize={9} textAnchor="end">{v}</text>
                        </g>
                    ))}

                    {yearTicks.map(d => (
                        <text key={d.year} x={xScale(d.year)} y={height - 4} fill="#a1a1aa" fontSize={9} textAnchor="middle">
                            {d.year}
                        </text>
                    ))}

                    {/* Area + line */}
                    <path d={areaPath} fill={HIGH_TEMP_COLOR} opacity={0.08} />
                    <path d={path} fill="none" stroke={HIGH_TEMP_COLOR} strokeWidth={2} opacity={0.8} />

                    {/* Hover zones */}
                    {filtered.map((d, i) => (
                        <rect
                            key={d.year}
                            x={xScale(d.year) - plotW / filtered.length / 2}
                            y={padding.top} width={plotW / filtered.length} height={plotH}
                            fill="transparent"
                            onMouseEnter={() => { setHovered(i); onHoverPeriod?.({ startYear: d.year - 9, endYear: d.year }); }}
                        />
                    ))}

                    {hoveredData && (
                        <>
                            <line x1={xScale(hoveredData.year)} y1={padding.top}
                                x2={xScale(hoveredData.year)} y2={padding.top + plotH}
                                stroke="#a1a1aa" strokeWidth={1} strokeDasharray="3,3" />
                            <circle cx={xScale(hoveredData.year)} cy={yScale(hoveredData.ratio!)} r={4}
                                fill={HIGH_TEMP_COLOR} stroke="#18181b" strokeWidth={2} />
                        </>
                    )}
                </svg>
            </div>
            {hoveredData && (
                <div className={`text-xs text-zinc-400 ${compact ? 'shrink-0 px-1 py-0.5' : 'mt-1'}`}>
                    <span className="text-zinc-200 font-medium">{hoveredData.year}</span>
                    {' — '}ratio: <span className="text-zinc-100 font-medium">{hoveredData.ratio?.toFixed(1)}:1</span>
                    <span className="text-zinc-400">
                        {' '}({hoveredData.highs10yr} highs / {hoveredData.lows10yr} lows over 10yr)
                    </span>
                </div>
            )}
        </div>
    );
}
