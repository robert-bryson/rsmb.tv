import { useEffect, useMemo } from 'react';
import { useStationHistory } from '../hooks/useStationHistory';
import type { StationDailyObs } from '../hooks/useStationHistory';
import { fToC } from '../utils/temperature';

interface StationDetailPanelProps {
    uid: number;
    stationName: string;
    state: string;
    useCelsius: boolean;
    onClose: () => void;
}

function formatTemp(f: number | null, celsius: boolean): string {
    if (f == null) return '—';
    return celsius ? `${Math.round(fToC(f))}°C` : `${f}°F`;
}

/** Simple SVG sparkline for a series of daily temps */
function TempSparkline({ data, useCelsius }: { data: StationDailyObs[]; useCelsius: boolean }) {
    const { highPath, lowPath, yMin, yMax, labels } = useMemo(() => {
        // Use last 365 days of data
        const recent = data.slice(-365);
        if (recent.length === 0) return { highPath: '', lowPath: '', yMin: 0, yMax: 100, labels: [] };

        const highs = recent.map(d => d.maxt);
        const lows = recent.map(d => d.mint);
        const allTemps = [...highs, ...lows].filter((t): t is number => t != null);
        if (allTemps.length === 0) return { highPath: '', lowPath: '', yMin: 0, yMax: 100, labels: [] };

        const rawMin = Math.min(...allTemps);
        const rawMax = Math.max(...allTemps);
        const yMin = useCelsius ? fToC(rawMin) : rawMin;
        const yMax = useCelsius ? fToC(rawMax) : rawMax;
        const range = yMax - yMin || 1;

        const w = 300;
        const h = 80;
        const pad = 4;

        function toY(temp: number | null): number | null {
            if (temp == null) return null;
            const t = useCelsius ? fToC(temp) : temp;
            return h - pad - ((t - yMin) / range) * (h - 2 * pad);
        }

        function buildPath(temps: (number | null)[]): string {
            const pts: string[] = [];
            for (let i = 0; i < temps.length; i++) {
                const y = toY(temps[i]);
                if (y == null) continue;
                const x = (i / (temps.length - 1)) * w;
                pts.push(`${pts.length === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
            }
            return pts.join(' ');
        }

        // Month labels
        const labels: { x: number; label: string }[] = [];
        let lastMonth = -1;
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        for (let i = 0; i < recent.length; i++) {
            const m = parseInt(recent[i].date.slice(5, 7), 10) - 1;
            if (m !== lastMonth) {
                labels.push({ x: (i / (recent.length - 1)) * w, label: months[m] });
                lastMonth = m;
            }
        }

        return {
            highPath: buildPath(highs),
            lowPath: buildPath(lows),
            yMin,
            yMax,
            labels,
        };
    }, [data, useCelsius]);

    if (!highPath && !lowPath) return <div className="text-zinc-500 text-xs py-4 text-center">No chart data available</div>;

    return (
        <div className="mt-2">
            <svg viewBox="0 0 300 100" className="w-full h-20" preserveAspectRatio="none">
                <desc>Temperature sparkline showing daily highs and lows over the past year</desc>
                {/* Y-axis labels */}
                <text x="2" y="12" fill="#a1a1aa" fontSize="8">{yMax}°</text>
                <text x="2" y="82" fill="#a1a1aa" fontSize="8">{yMin}°</text>
                {/* Month labels */}
                {labels.filter((_, i) => i % 2 === 0).map(({ x, label }) => (
                    <text key={`${x}-${label}`} x={x} y="96" fill="#71717a" fontSize="7" textAnchor="middle">{label}</text>
                ))}
                {/* Low temps */}
                <path d={lowPath} fill="none" stroke="#3b82f6" strokeWidth="1" opacity="0.6" />
                {/* High temps */}
                <path d={highPath} fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.8" />
            </svg>
        </div>
    );
}

export function StationDetailPanel({ uid, stationName, state, useCelsius, onClose }: StationDetailPanelProps) {
    const { history, loading, error, fetch, clear } = useStationHistory();

    useEffect(() => {
        fetch(uid, 2);
        return clear;
    }, [uid, fetch, clear]);

    // Compute stats from loaded data
    const stats = useMemo(() => {
        if (!history?.data.length) return null;
        const last30 = history.data.slice(-30);
        const highs = last30.map(d => d.maxt).filter((t): t is number => t != null);
        const lows = last30.map(d => d.mint).filter((t): t is number => t != null);
        return {
            avgHigh: highs.length ? Math.round(highs.reduce((s, t) => s + t, 0) / highs.length) : null,
            avgLow: lows.length ? Math.round(lows.reduce((s, t) => s + t, 0) / lows.length) : null,
            maxHigh: highs.length ? Math.max(...highs) : null,
            minLow: lows.length ? Math.min(...lows) : null,
            days: last30.length,
        };
    }, [history]);

    const meta = history?.meta;

    return (
        <div className="absolute right-0 bottom-0 md:bottom-auto md:top-14 md:right-4 z-20 w-full md:w-80 max-h-[40dvh] md:max-h-[calc(100vh-6rem)] bg-zinc-900/95 backdrop-blur-sm border-t md:border border-zinc-700/50 md:rounded-lg overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-800 px-3 py-2 z-10">
                <div className="flex items-center justify-between mb-1">
                    <button
                        onClick={onClose}
                        className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                        ← Back to records
                    </button>
                    <button
                        onClick={onClose}
                        className="text-zinc-400 hover:text-zinc-200 w-7 h-7 flex items-center justify-center rounded hover:bg-zinc-800 transition-colors text-sm shrink-0"
                        aria-label="Close station detail"
                    >
                        ✕
                    </button>
                </div>
                <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-zinc-200 truncate">{meta?.name ?? stationName}</h2>
                    <p className="text-xs text-zinc-500">
                        {state}
                        {meta?.elev != null && ` · ${meta.elev} ft`}
                    </p>
                </div>
            </div>

            <div className="px-3 py-2">
                {loading && (
                    <div className="flex items-center gap-2 py-4 text-zinc-400 text-sm">
                        <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
                        Loading station history…
                    </div>
                )}

                {error && (
                    <div className="py-4 text-center">
                        <p className="text-red-400 text-sm mb-2">Failed to load station data</p>
                        <button
                            onClick={() => fetch(uid, 2)}
                            className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {history && !loading && (
                    <>
                        {/* Sparkline */}
                        <TempSparkline data={history.data} useCelsius={useCelsius} />

                        {/* 30-day stats */}
                        {stats && (
                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                <div className="bg-zinc-800/50 rounded px-2 py-1.5">
                                    <div className="text-zinc-500">Avg High <span className="text-zinc-600">(30d)</span></div>
                                    <div className="text-red-400 font-semibold">{formatTemp(stats.avgHigh, useCelsius)}</div>
                                </div>
                                <div className="bg-zinc-800/50 rounded px-2 py-1.5">
                                    <div className="text-zinc-500">Avg Low <span className="text-zinc-600">(30d)</span></div>
                                    <div className="text-blue-400 font-semibold">{formatTemp(stats.avgLow, useCelsius)}</div>
                                </div>
                                <div className="bg-zinc-800/50 rounded px-2 py-1.5">
                                    <div className="text-zinc-500">Max High <span className="text-zinc-600">(30d)</span></div>
                                    <div className="text-red-400 font-semibold">{formatTemp(stats.maxHigh, useCelsius)}</div>
                                </div>
                                <div className="bg-zinc-800/50 rounded px-2 py-1.5">
                                    <div className="text-zinc-500">Min Low <span className="text-zinc-600">(30d)</span></div>
                                    <div className="text-blue-400 font-semibold">{formatTemp(stats.minLow, useCelsius)}</div>
                                </div>
                            </div>
                        )}

                        {/* Recent observations table */}
                        <div className="mt-3">
                            <h3 className="text-xs font-medium text-zinc-400 mb-1">Recent Observations</h3>
                            <div className="max-h-48 overflow-y-auto">
                                <table className="w-full text-xs">
                                    <thead className="sticky top-0 bg-zinc-900">
                                        <tr className="text-zinc-500 border-b border-zinc-800">
                                            <th className="text-left py-1 font-medium">Date</th>
                                            <th className="text-right py-1 font-medium">High</th>
                                            <th className="text-right py-1 font-medium">Low</th>
                                            <th className="text-right py-1 font-medium">Pcpn</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {history.data.slice(-14).reverse().map((obs) => (
                                            <tr key={obs.date} className="border-b border-zinc-800/50 text-zinc-300">
                                                <td className="py-0.5">{obs.date.slice(5)}</td>
                                                <td className="text-right text-red-400/80">{formatTemp(obs.maxt, useCelsius)}</td>
                                                <td className="text-right text-blue-400/80">{formatTemp(obs.mint, useCelsius)}</td>
                                                <td className="text-right text-zinc-500">{obs.pcpn != null ? `${obs.pcpn}"` : '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <p className="mt-2 text-[10px] text-zinc-600">
                            {history.data.length} days loaded · Source: ACIS/RCC
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}
