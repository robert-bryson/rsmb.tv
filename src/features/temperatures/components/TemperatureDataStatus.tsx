import { useEffect, useState } from 'react';
import { CONUS_STATES } from '../constants';
import type { CountyRecordsCollection, RecentRecords, StateRecordsCollection, TemperatureSummary, TimePeriod, ViewMode } from '../types';
import { getRecentObservationDate } from '../utils/temperature';

interface Props {
    viewMode: ViewMode;
    recentRecords: RecentRecords | null;
    countyRecords: CountyRecordsCollection | null;
    stateRecords: StateRecordsCollection | null;
    summary: TemperatureSummary | null;
    activePeriod?: TimePeriod;
}

/** Coverage comes from the actual snapshot, rather than attempted request counts. */
export function TemperatureDataStatus({ viewMode, recentRecords, countyRecords, stateRecords, summary, activePeriod = 'yesterday' }: Props) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 60_000);
        return () => clearInterval(timer);
    }, []);
    const isRecent = viewMode === 'recent';
    const records = viewMode === 'state' ? stateRecords : countyRecords;
    if (isRecent ? !recentRecords : !records && !summary) return null;
    const expected = viewMode === 'state' ? [...CONUS_STATES, 'AK', 'HI'] : CONUS_STATES;
    let completed: string[] | null = null;
    if (isRecent && recentRecords) {
        const observationDate = getRecentObservationDate(recentRecords);
        const dates = activePeriod === 'yesterday' ? [observationDate] : Array.from({ length: 7 }, (_, index) => {
            const date = new Date(`${observationDate}T00:00:00Z`);
            date.setUTCDate(date.getUTCDate() - index);
            return date.toISOString().slice(0, 10);
        });
        if (dates.every(date => recentRecords.coverageByDate?.[date])) {
            completed = expected.filter(state => dates.every(date => {
                const coverage = recentRecords.coverageByDate![date];
                return coverage.expectedStates.includes(state) && coverage.completedStates.includes(state);
            }));
        }
    } else if (records) {
        const states = new Set(records.features.map(feature => feature.properties.state));
        completed = expected.filter(state => states.has(state));
    } else if (viewMode !== 'state' && summary?.countyCoverage) {
        const coverage = summary.countyCoverage;
        completed = expected.filter(state => coverage.expectedStates.includes(state) && coverage.completedStates.includes(state));
    }
    const missing = completed ? expected.filter(state => !completed.includes(state)) : [];
    const updated = isRecent ? recentRecords?.generatedAt ?? recentRecords?.asOf : summary?.lastUpdated;
    const timestamp = updated ? Date.parse(updated) : Number.NaN;
    const stale = Number.isFinite(timestamp) && now - timestamp > (isRecent ? 2 : 45) * 86_400_000;
    const hasTime = updated?.includes('T');
    const updateLabel = Number.isFinite(timestamp)
        ? new Date(timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
            ...(hasTime ? { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' } as const : {}) })
        : 'unavailable';
    return (
        <p role="status" className={`text-xs leading-relaxed ${stale || missing.length ? 'text-amber-300' : 'text-zinc-300'}`}>
            {isRecent && !hasTime ? 'As of' : 'Updated'} {updateLabel}{stale && ' · Stale data'}
            <span className="block" title={missing.length ? `Missing states: ${missing.join(', ')}` : undefined}>
                {completed ? `${completed.length}/${expected.length} states` : 'Coverage unverified'}
                {missing.length > 0 && ` · Missing ${missing.length <= 3 ? missing.join(', ') : `${missing.length} states`}`}
            </span>
        </p>
    );
}
