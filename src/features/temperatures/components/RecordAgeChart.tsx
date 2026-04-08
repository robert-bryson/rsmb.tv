import { useState } from 'react';
import type { DecadeData, HighlightRange } from '../types';
import { HIGH_TEMP_COLOR, LOW_TEMP_COLOR, yearToColor } from '../constants';

interface Props {
    data: DecadeData[];
    onHoverPeriod?: (range: HighlightRange | null) => void;
    selectedDecade?: number | null;
    onSelectDecade?: (decade: number | null) => void;
    compact?: boolean;
}

/**
 * Mirrored bar chart: record highs go up (red), record lows go down (blue).
 * Shows when all-time county records were set, grouped by decade.
 */
export function RecordAgeChart({ data, onHoverPeriod, selectedDecade, onSelectDecade, compact }: Props) {
    const [hovered, setHovered] = useState<number | null>(null);
    const [localSelected, setLocalSelected] = useState<number | null>(null);

    // Filter to decades with meaningful data (skip very early sparse ones)
    const filtered = data.filter(d => d.decade >= 1890);

    // Use shared selection if provided, otherwise fall back to local
    const selectedIdx = selectedDecade !== undefined
        ? filtered.findIndex(d => d.decade === selectedDecade)
        : localSelected;
    const selected = selectedIdx === -1 ? null : selectedIdx;
    const setSelected = (idx: number | null) => {
        const decade = idx !== null ? filtered[idx]?.decade ?? null : null;
        if (onSelectDecade) onSelectDecade(decade);
        else setLocalSelected(idx);
    };
    const maxVal = Math.max(...filtered.flatMap(d => [d.highs, d.lows]));

    // Cumulative records set up to each decade
    const cumTotal: number[] = [];
    const cumHighs: number[] = [];
    const cumLows: number[] = [];
    let runTotal = 0, runHighs = 0, runLows = 0;
    for (const d of filtered) {
        runTotal += d.highs + d.lows;
        runHighs += d.highs;
        runLows += d.lows;
        cumTotal.push(runTotal);
        cumHighs.push(runHighs);
        cumLows.push(runLows);
    }
    const maxCumulative = cumTotal[cumTotal.length - 1] || 1;

    const barWidth = 44;
    const gap = 6;
    const chartWidth = filtered.length * (barWidth + gap) - gap;
    const halfHeight = 160;
    const svgHeight = halfHeight * 2 + 40; // extra for labels
    const midY = halfHeight + 10;

    const scale = (val: number) => (val / maxVal) * halfHeight;
    const cumulativeY = (val: number) => midY - (val / maxCumulative) * halfHeight * 0.85;

    const activeIndex = hovered ?? selected;

    return (
        <div className={compact ? 'flex flex-col h-full' : ''}>
            {!compact && (
                <>
                    <h3 className="text-sm font-semibold text-zinc-200 mb-1">When Were All-Time Records Set?</h3>
                    <p className="text-xs text-zinc-400 mb-4">
                        Distribution of 6,078 county all-time record highs and lows by the decade they were set.
                        Highs go up, lows go down. Color matches the freshness map. Click a decade to lock selection.
                    </p>
                </>
            )}
            <div className={compact ? 'flex-1 min-h-0' : 'overflow-x-auto'}>
                <svg
                    viewBox={`0 0 ${chartWidth + 60} ${svgHeight + 20}`}
                    className={compact ? 'w-full h-full' : 'w-full min-w-[500px]'}
                    preserveAspectRatio={compact ? 'xMidYMid meet' : undefined}
                    role="img"
                    aria-label="Record age distribution by decade"
                    onClick={() => { setSelected(null); onHoverPeriod?.(null); }}
                    onMouseLeave={() => {
                        setHovered(null);
                        if (selected !== null) {
                            const sd = filtered[selected];
                            onHoverPeriod?.({ startYear: sd.decade, endYear: sd.decade + 9 });
                        } else {
                            onHoverPeriod?.(null);
                        }
                    }}
                >
                    <desc>Mirrored bar chart showing when county all-time temperature records were set, grouped by decade from 1890s to 2020s. Record highs extend upward, record lows extend downward.</desc>
                    {/* Center line */}
                    <line
                        x1={30} y1={midY} x2={chartWidth + 40} y2={midY}
                        stroke="#3f3f46" strokeWidth={1}
                    />

                    {/* Y-axis labels */}
                    <text x={26} y={midY - scale(maxVal) + 4} fill="#a1a1aa" fontSize={10} textAnchor="end">
                        {maxVal}
                    </text>
                    <text x={26} y={midY + scale(maxVal) + 4} fill="#a1a1aa" fontSize={10} textAnchor="end">
                        {maxVal}
                    </text>
                    <text x={2} y={midY - halfHeight / 2} fill={HIGH_TEMP_COLOR} fontSize={9} textAnchor="start"
                        transform={`rotate(-90, 8, ${midY - halfHeight / 2})`}>
                        Highs ↑
                    </text>
                    <text x={2} y={midY + halfHeight / 2} fill={LOW_TEMP_COLOR} fontSize={9} textAnchor="start"
                        transform={`rotate(-90, 8, ${midY + halfHeight / 2})`}>
                        Lows ↓
                    </text>

                    {filtered.map((d, i) => {
                        const x = 35 + i * (barWidth + gap);
                        const hH = scale(d.highs);
                        const hL = scale(d.lows);
                        const isActive = activeIndex === i;
                        const opacity = activeIndex === null || isActive ? 1 : 0.4;
                        const decadeColor = yearToColor(d.decade);

                        return (
                            <g
                                key={d.decade}
                                onMouseEnter={() => {
                                    setHovered(i);
                                    onHoverPeriod?.({ startYear: d.decade, endYear: d.decade + 9 });
                                }}
                                onMouseLeave={() => {
                                    setHovered(null);
                                    if (selected !== null) {
                                        const sd = filtered[selected];
                                        onHoverPeriod?.({ startYear: sd.decade, endYear: sd.decade + 9 });
                                    }
                                }}
                                onClick={(e) => { e.stopPropagation(); setSelected(selected === i ? null : i); }}
                                style={{ cursor: 'pointer' }}
                            >
                                {/* Selected indicator */}
                                {selected === i && (
                                    <rect
                                        x={x - 3} y={midY - hH - 3}
                                        width={barWidth + 6} height={hH + hL + 6}
                                        fill="none" stroke="#a78bfa" strokeWidth={1.5}
                                        rx={4} strokeDasharray="4 2"
                                    />
                                )}

                                {/* High bar (going up) — colored by decade */}
                                <rect
                                    x={x} y={midY - hH} width={barWidth} height={hH}
                                    fill={decadeColor} opacity={opacity * 0.85}
                                    rx={2}
                                />
                                {/* Low bar (going down) — colored by decade */}
                                <rect
                                    x={x} y={midY} width={barWidth} height={hL}
                                    fill={decadeColor} opacity={opacity * 0.85}
                                    rx={2}
                                />

                                {/* Decade label */}
                                <text
                                    x={x + barWidth / 2} y={svgHeight + 8}
                                    fill="#a1a1aa" fontSize={10} textAnchor="middle"
                                >
                                    {d.label}
                                </text>

                                {/* Values on hover/select */}
                                {isActive && (
                                    <>
                                        <text x={x + barWidth / 2} y={midY - hH - 6}
                                            fill="#fca5a5" fontSize={11} fontWeight={600} textAnchor="middle">
                                            {d.highs}
                                        </text>
                                        <text x={x + barWidth / 2} y={midY + hL + 14}
                                            fill="#93c5fd" fontSize={11} fontWeight={600} textAnchor="middle">
                                            {d.lows}
                                        </text>
                                        {d.ratio !== null && (
                                            <text x={x + barWidth / 2} y={midY - hH - 18}
                                                fill="#d4d4d8" fontSize={9} textAnchor="middle">
                                                {d.ratio}:1
                                            </text>
                                        )}
                                    </>
                                )}
                            </g>
                        );
                    })}

                    {/* Cumulative highs line */}
                    <polyline
                        points={filtered.map((_, i) => {
                            const x = 35 + i * (barWidth + gap) + barWidth / 2;
                            return `${x},${cumulativeY(cumHighs[i])}`;
                        }).join(' ')}
                        fill="none" stroke={HIGH_TEMP_COLOR} strokeWidth={1.5}
                        strokeLinejoin="round" opacity={0.35}
                        style={{ pointerEvents: 'none' }}
                    />
                    {/* Cumulative lows line */}
                    <polyline
                        points={filtered.map((_, i) => {
                            const x = 35 + i * (barWidth + gap) + barWidth / 2;
                            return `${x},${cumulativeY(cumLows[i])}`;
                        }).join(' ')}
                        fill="none" stroke={LOW_TEMP_COLOR} strokeWidth={1.5}
                        strokeLinejoin="round" opacity={0.35}
                        style={{ pointerEvents: 'none' }}
                    />
                    {/* Cumulative total line */}
                    <polyline
                        points={filtered.map((_, i) => {
                            const x = 35 + i * (barWidth + gap) + barWidth / 2;
                            return `${x},${cumulativeY(cumTotal[i])}`;
                        }).join(' ')}
                        fill="none" stroke="#d4d4d8" strokeWidth={1.5}
                        strokeLinejoin="round" opacity={0.5}
                        style={{ pointerEvents: 'none' }}
                    />
                    {/* Dots for all three lines */}
                    {filtered.map((_, i) => {
                        const x = 35 + i * (barWidth + gap) + barWidth / 2;
                        const isAct = activeIndex === i;
                        const r = isAct ? 3.5 : 2;
                        const opac = isAct ? 1 : 0.35;
                        return (
                            <g key={`dots-${i}`} style={{ pointerEvents: 'none' }}>
                                <circle cx={x} cy={cumulativeY(cumTotal[i])} r={r}
                                    fill={isAct ? '#ffffff' : '#d4d4d8'} opacity={opac} />
                                <circle cx={x} cy={cumulativeY(cumHighs[i])} r={r}
                                    fill={HIGH_TEMP_COLOR} opacity={opac} />
                                <circle cx={x} cy={cumulativeY(cumLows[i])} r={r}
                                    fill={LOW_TEMP_COLOR} opacity={opac} />
                            </g>
                        );
                    })}
                    {/* Tooltip on hover/select */}
                    {activeIndex !== null && (() => {
                        const tx = 35 + activeIndex * (barWidth + gap) + barWidth / 2;
                        const topY = cumulativeY(cumTotal[activeIndex]);
                        return (
                            <g style={{ pointerEvents: 'none' }}>
                                <rect x={tx - 52} y={topY - 48} width={104} height={42}
                                    fill="#18181b" fillOpacity={0.9} rx={4}
                                    stroke="#3f3f46" strokeWidth={0.5} />
                                <text x={tx} y={topY - 34} fill="#e4e4e7" fontSize={10} fontWeight={600} textAnchor="middle">
                                    {cumTotal[activeIndex].toLocaleString()} total
                                </text>
                                <text x={tx} y={topY - 22} fill="#fca5a5" fontSize={9} textAnchor="middle">
                                    {cumHighs[activeIndex].toLocaleString()} highs
                                </text>
                                <text x={tx} y={topY - 11} fill="#93c5fd" fontSize={9} textAnchor="middle">
                                    {cumLows[activeIndex].toLocaleString()} lows
                                </text>
                            </g>
                        );
                    })()}
                    {/* End label when nothing is active */}
                    {activeIndex === null && (
                        <text
                            x={35 + (filtered.length - 1) * (barWidth + gap) + barWidth / 2}
                            y={cumulativeY(maxCumulative) - 8}
                            fill="#a1a1aa" fontSize={9} textAnchor="middle"
                            style={{ pointerEvents: 'none' }}
                        >
                            {maxCumulative.toLocaleString()}
                        </text>
                    )}
                </svg>
            </div>
            {!compact && (
                <p className="text-[10px] text-zinc-500 mt-2">
                    The 1930s Dust Bowl dominates record highs. Recent decades (2000s–2010s) show a resurgence of record highs relative to lows.
                    Lines show cumulative standing records over time (total, highs, lows).
                </p>
            )}
        </div>
    );
}
