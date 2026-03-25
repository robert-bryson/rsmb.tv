import { useState } from 'react';
import type { DecadeData, HighlightRange } from '../types';
import { HIGH_TEMP_COLOR, LOW_TEMP_COLOR } from '../constants';

interface Props {
    data: DecadeData[];
    onHoverPeriod?: (range: HighlightRange | null) => void;
    compact?: boolean;
}

/**
 * Mirrored bar chart: record highs go up (red), record lows go down (blue).
 * Shows when all-time county records were set, grouped by decade.
 */
export function RecordAgeChart({ data, onHoverPeriod, compact }: Props) {
    const [hovered, setHovered] = useState<number | null>(null);

    // Filter to decades with meaningful data (skip very early sparse ones)
    const filtered = data.filter(d => d.decade >= 1890);
    const maxVal = Math.max(...filtered.flatMap(d => [d.highs, d.lows]));

    const barWidth = 44;
    const gap = 6;
    const chartWidth = filtered.length * (barWidth + gap) - gap;
    const halfHeight = 160;
    const svgHeight = halfHeight * 2 + 40; // extra for labels
    const midY = halfHeight + 10;

    const scale = (val: number) => (val / maxVal) * halfHeight;

    return (
        <div className={compact ? 'flex flex-col h-full' : ''}>
            {!compact && (
                <>
                    <h3 className="text-sm font-semibold text-zinc-200 mb-1">When Were All-Time Records Set?</h3>
                    <p className="text-xs text-zinc-500 mb-4">
                        Distribution of 6,078 county all-time record highs and lows by the decade they were set.
                        Highs (red) go up, lows (blue) go down.
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
                    onMouseLeave={() => onHoverPeriod?.(null)}
                >
                    {/* Center line */}
                    <line
                        x1={30} y1={midY} x2={chartWidth + 40} y2={midY}
                        stroke="#3f3f46" strokeWidth={1}
                    />

                    {/* Y-axis labels */}
                    <text x={26} y={midY - scale(maxVal) + 4} fill="#71717a" fontSize={10} textAnchor="end">
                        {maxVal}
                    </text>
                    <text x={26} y={midY + scale(maxVal) + 4} fill="#71717a" fontSize={10} textAnchor="end">
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
                        const isHovered = hovered === i;
                        const opacity = hovered === null || isHovered ? 1 : 0.4;

                        return (
                            <g
                                key={d.decade}
                                onMouseEnter={() => {
                                    setHovered(i);
                                    onHoverPeriod?.({ startYear: d.decade, endYear: d.decade + 9 });
                                }}
                                onMouseLeave={() => setHovered(null)}
                                style={{ cursor: 'default' }}
                            >
                                {/* High bar (going up) */}
                                <rect
                                    x={x} y={midY - hH} width={barWidth} height={hH}
                                    fill={HIGH_TEMP_COLOR} opacity={opacity * 0.85}
                                    rx={2}
                                />
                                {/* Low bar (going down) */}
                                <rect
                                    x={x} y={midY} width={barWidth} height={hL}
                                    fill={LOW_TEMP_COLOR} opacity={opacity * 0.85}
                                    rx={2}
                                />

                                {/* Decade label */}
                                <text
                                    x={x + barWidth / 2} y={svgHeight + 8}
                                    fill="#a1a1aa" fontSize={10} textAnchor="middle"
                                >
                                    {d.label}
                                </text>

                                {/* Values on hover */}
                                {isHovered && (
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
                </svg>
            </div>
            {!compact && (
                <p className="text-[10px] text-zinc-600 mt-2">
                    The 1930s Dust Bowl dominates record highs. Recent decades (2000s–2010s) show a resurgence of record highs relative to lows.
                </p>
            )}
        </div>
    );
}
