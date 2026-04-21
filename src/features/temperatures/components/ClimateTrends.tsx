import { Suspense, lazy, useState } from 'react';
import { Link } from 'react-router-dom';
import { useClimateTrends } from '../hooks/useClimateTrends';
import { RecordAgeChart } from './RecordAgeChart';
import { RecordsBrokenTimeSeries } from './RecordsBrokenTimeSeries';
import { HighLowRatioChart } from './HighLowRatioChart';

const RecordFreshnessMap = lazy(() =>
    import('./RecordFreshnessMap').then((m) => ({ default: m.RecordFreshnessMap })),
);

type Section = 'age' | 'timeseries' | 'ratio' | 'map';

const SECTIONS: { id: Section; label: string }[] = [
    { id: 'age', label: 'Record Age' },
    { id: 'timeseries', label: 'Frequency' },
    { id: 'ratio', label: 'H:L Ratio' },
    { id: 'map', label: 'Freshness Map' },
];

export function ClimateTrends() {
    const { trends, loading, error } = useClimateTrends();
    const [active, setActive] = useState<Section>('age');

    if (error) {
        return (
            <div className="p-6 text-center text-zinc-400">
                <p>Failed to load climate trend data</p>
                <p className="text-xs mt-1">{error}</p>
            </div>
        );
    }

    if (loading || !trends) {
        return (
            <div className="p-6 space-y-4 animate-pulse">
                <div className="h-5 w-48 bg-zinc-800 rounded" />
                <div className="h-64 bg-zinc-800/40 rounded" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="shrink-0 px-4 pt-4 pb-2 border-b border-zinc-800">
                <div className="flex items-center gap-3 mb-3">
                    <Link
                        to="/projects/temperature-records"
                        className="text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
                    >
                        ← Map
                    </Link>
                    <h1 className="text-base font-semibold text-zinc-100">Climate Trends</h1>
                </div>
                <p className="text-xs text-zinc-400 mb-3">
                    Are temperature records being broken more frequently? Analysis of {trends.totalHighs.toLocaleString()} record highs
                    and {trends.totalLows.toLocaleString()} record lows across US counties.
                </p>

                {/* Section tabs */}
                <nav className="flex gap-1">
                    {SECTIONS.map(s => (
                        <button
                            key={s.id}
                            onClick={() => setActive(s.id)}
                            className={`px-3 py-1.5 text-xs rounded-t transition-colors ${active === s.id
                                ? 'bg-zinc-800 text-violet-400 border-b-2 border-violet-400'
                                : 'text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/50'
                                }`}
                        >
                            {s.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
                {active === 'age' && (
                    <RecordAgeChart data={trends.byDecade} />
                )}
                {active === 'timeseries' && (
                    <RecordsBrokenTimeSeries data={trends.byYear} />
                )}
                {active === 'ratio' && (
                    <HighLowRatioChart decadeData={trends.byDecade} rollingData={trends.rollingRatio} />
                )}
                {active === 'map' && (
                    <Suspense
                        fallback={
                            <div className="h-64 grid place-items-center text-zinc-400 text-xs">
                                Loading freshness map...
                            </div>
                        }
                    >
                        <RecordFreshnessMap />
                    </Suspense>
                )}

                {/* Common footer */}
                <div className="mt-6 pt-4 border-t border-zinc-800 text-[10px] text-zinc-500 space-y-1">
                    <p>Data: NOAA / ACIS · County all-time records from period of record (1890s–present)</p>
                    <p>Analysis based on {(trends.totalHighs + trends.totalLows).toLocaleString()} county-level all-time records across 48 contiguous states.</p>
                </div>
            </div>
        </div>
    );
}
