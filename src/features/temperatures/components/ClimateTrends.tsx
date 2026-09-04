import { Suspense, lazy } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
    { id: 'timeseries', label: 'Year Set (5yr avg)' },
    { id: 'ratio', label: 'High : Low Ratio' },
    { id: 'map', label: 'Record Age Map' },
];

export function ClimateTrends() {
    const { trends, loading, error } = useClimateTrends();
    const [searchParams, setSearchParams] = useSearchParams();
    const tab = searchParams.get('tab');
    const active: Section = SECTIONS.some(section => section.id === tab) ? tab as Section : 'age';
    const totalRecords = trends ? trends.totalHighs + trends.totalLows : 0;
    const recordsSince2000 = trends?.byDecade
        .filter(decade => decade.decade >= 2000)
        .reduce((total, decade) => total + decade.highs + decade.lows, 0) ?? 0;
    const recentShare = totalRecords > 0 ? (recordsSince2000 / totalRecords) * 100 : 0;

    const setActive = (section: Section) => {
        setSearchParams(previous => {
            const next = new URLSearchParams(previous);
            if (section === 'age') next.delete('tab');
            else next.set('tab', section);
            return next;
        }, { replace: true });
    };

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
                        to="/projects/temperature-records/map?view=freshness"
                        className="text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
                    >
                        ← Map
                    </Link>
                    <h1 className="text-base font-semibold text-zinc-100">Standing Record History</h1>
                </div>
                <p className="text-xs text-zinc-400 mb-3">
                    When were today&apos;s standing contiguous U.S. county extremes set? This view groups {trends.totalHighs.toLocaleString()} current highs
                    and {trends.totalLows.toLocaleString()} current lows by their record date. Superseded records are not included.
                </p>
                <dl className="grid grid-cols-3 gap-2 mb-3" aria-label="Standing record summary">
                    <div className="rounded bg-zinc-900 px-2.5 py-2">
                        <dt className="text-[10px] text-zinc-500">Standing county extremes</dt>
                        <dd className="text-sm font-semibold text-zinc-200">{totalRecords.toLocaleString()}</dd>
                    </div>
                    <div className="rounded bg-zinc-900 px-2.5 py-2">
                        <dt className="text-[10px] text-zinc-500">Set since 2000</dt>
                        <dd className="text-sm font-semibold text-zinc-200">{recentShare.toFixed(1)}%</dd>
                    </div>
                    <div className="rounded bg-zinc-900 px-2.5 py-2">
                        <dt className="text-[10px] text-zinc-500">Geographic scope</dt>
                        <dd className="text-sm font-semibold text-zinc-200">Contiguous U.S.</dd>
                    </div>
                </dl>

                {/* Section tabs */}
                <nav className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Standing record views">
                    {SECTIONS.map(s => (
                        <button
                            key={s.id}
                            role="tab"
                            aria-selected={active === s.id}
                            aria-controls={`trend-panel-${s.id}`}
                            onClick={() => setActive(s.id)}
                            className={`shrink-0 px-3 py-1.5 text-xs rounded-t transition-colors ${active === s.id
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
            <div
                id={`trend-panel-${active}`}
                role="tabpanel"
                className="flex-1 overflow-y-auto p-4"
            >
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
                    <p>Data: NOAA / ACIS · Contiguous U.S. county all-time records from period of record (1890s–present)</p>
                    <p>Descriptive record-age analysis only; this is not a count of every historical record-breaking event.</p>
                    <p className="flex gap-3">
                        <a className="text-violet-400 hover:text-violet-300" href="/temperature-records-methodology.md" download>Download methodology</a>
                        <a className="text-violet-400 hover:text-violet-300" href="https://data.rsmb.tv/climateTrends.json" download>Download chart data</a>
                    </p>
                </div>
            </div>
        </div>
    );
}
