import { useState, useMemo, useRef } from 'react';
import type { RecentRecords, TimePeriod, BrokenRecord, CountyRecordsCollection, StateRecordsCollection, ViewMode } from '../types';
import { TIME_PERIODS, TIME_PERIOD_LABELS, HIGH_TEMP_COLOR, LOW_TEMP_COLOR, yearToColor } from '../constants';
import { formatComparisonPeriod, formatTemp } from '../utils/temperature';

type FreshnessSort = 'hottest' | 'coldest' | 'oldest' | 'newest';
type TemperatureRecordType = 'high' | 'low';

const SORT_LABELS: Record<FreshnessSort, string> = {
    hottest: 'Hottest',
    coldest: 'Coldest',
    oldest: 'Oldest Record',
    newest: 'Newest Record',
};

const SORT_OPTIONS: FreshnessSort[] = ['hottest', 'coldest', 'oldest', 'newest'];

interface SummaryPanelProps {
    viewMode: ViewMode;
    recentRecords?: RecentRecords | null;
    countyRecords?: CountyRecordsCollection | null;
    stateRecords?: StateRecordsCollection | null;
    recordType: TemperatureRecordType;
    onRecordTypeChange: (type: TemperatureRecordType) => void;
    useCelsius: boolean;
    onFlyTo?: (lng: number, lat: number) => void;
    onSelectState?: (state: string) => void;
    activePeriod: TimePeriod;
    onPeriodChange: (period: TimePeriod) => void;
    recentSort?: RecordSort;
    onRecentSortChange?: (sort: RecordSort) => void;
}

export function SummaryPanel({ viewMode, recentRecords, countyRecords, stateRecords, recordType, onRecordTypeChange, useCelsius, onFlyTo, onSelectState, activePeriod, onPeriodChange, recentSort, onRecentSortChange }: SummaryPanelProps) {
    if (viewMode === 'freshness') {
        return (
            <FreshnessPanel
                countyRecords={countyRecords}
                recordType={recordType}
                onRecordTypeChange={onRecordTypeChange}
                useCelsius={useCelsius}
                onFlyTo={onFlyTo}
            />
        );
    }

    if (viewMode === 'county') {
        return (
            <CountyRecordsPanel
                countyRecords={countyRecords}
                recordType={recordType}
                onRecordTypeChange={onRecordTypeChange}
                useCelsius={useCelsius}
                onFlyTo={onFlyTo}
            />
        );
    }

    if (viewMode === 'state') {
        return (
            <StateRecordsPanel
                stateRecords={stateRecords}
                recordType={recordType}
                onRecordTypeChange={onRecordTypeChange}
                useCelsius={useCelsius}
                onSelectState={onSelectState}
            />
        );
    }

    if (!recentRecords) return null;

    return <RecordsPanel recentRecords={recentRecords} useCelsius={useCelsius} onFlyTo={onFlyTo} activePeriod={activePeriod} onPeriodChange={onPeriodChange} sort={recentSort} onSortChange={onRecentSortChange} />;
}

/* ---------- Records mode panel ---------- */

export type RecordSort = 'temp' | 'margin' | 'departure';

const RECORD_SORT_LABELS: Record<RecordSort, string> = {
    temp: 'Temp',
    margin: 'Margin',
    departure: 'vs Avg',
};
const RECORD_SORT_OPTIONS: RecordSort[] = ['temp', 'margin', 'departure'];
const PAGE_SIZE = 25;

function getMargin(r: BrokenRecord): number {
    return r.type === 'high' ? r.tempF - r.prevRecordF : r.prevRecordF - r.tempF;
}

function getDeparture(r: BrokenRecord): number {
    if (r.normalF == null) return 0;
    return r.type === 'high' ? r.tempF - r.normalF : r.normalF - r.tempF;
}

function sortRecords(records: BrokenRecord[], sort: RecordSort): BrokenRecord[] {
    const copy = [...records];
    switch (sort) {
        case 'temp':
            return copy.sort((a, b) =>
                a.type === 'high' ? b.tempF - a.tempF : a.tempF - b.tempF
            );
        case 'margin':
            return copy.sort((a, b) => getMargin(b) - getMargin(a));
        case 'departure':
            return copy.sort((a, b) => getDeparture(b) - getDeparture(a));
    }
}

function RecordsPanel({ recentRecords, useCelsius, onFlyTo, activePeriod, onPeriodChange, sort = 'departure', onSortChange }: { recentRecords: RecentRecords; useCelsius: boolean; onFlyTo?: (lng: number, lat: number) => void; activePeriod: TimePeriod; onPeriodChange: (period: TimePeriod) => void; sort?: RecordSort; onSortChange?: (sort: RecordSort) => void }) {
    const [highsVisible, setHighsVisible] = useState(PAGE_SIZE);
    const [lowsVisible, setLowsVisible] = useState(PAGE_SIZE);
    const highsRef = useRef<HTMLDivElement>(null);
    const lowsRef = useRef<HTMLDivElement>(null);

    // Reset pagination when switching tabs or sort
    const handlePeriodChange = (period: TimePeriod) => {
        onPeriodChange(period);
        setHighsVisible(PAGE_SIZE);
        setLowsVisible(PAGE_SIZE);
    };
    const handleSortChange = (s: RecordSort) => {
        onSortChange?.(s);
        setHighsVisible(PAGE_SIZE);
        setLowsVisible(PAGE_SIZE);
    };

    const records = useMemo(
        () => recentRecords[activePeriod] || [],
        [recentRecords, activePeriod]
    );
    const highs = useMemo(
        () => sortRecords(records.filter((r: BrokenRecord) => r.type === 'high'), sort),
        [records, sort]
    );
    const lows = useMemo(
        () => sortRecords(records.filter((r: BrokenRecord) => r.type === 'low'), sort),
        [records, sort]
    );

    const handleRowClick = (record: BrokenRecord) => {
        if (onFlyTo) onFlyTo(record.lon, record.lat);
    };

    return (
        <div className="absolute bottom-0 left-0 right-0 z-20 max-h-[40dvh] md:bottom-auto md:top-14 md:right-4 md:left-auto md:w-80 md:max-h-[calc(100dvh-6rem)] overflow-hidden flex flex-col bg-zinc-900/90 backdrop-blur md:rounded-lg border-t md:border border-zinc-700/50 text-zinc-200">
            {/* Tabs */}
            <div className="flex border-b border-zinc-700/50 shrink-0">
                {TIME_PERIODS.map(period => (
                    <button
                        key={period}
                        onClick={() => handlePeriodChange(period)}
                        className={`flex-1 min-w-0 px-3 py-2 text-xs whitespace-nowrap transition-colors ${activePeriod === period
                            ? 'text-violet-400 border-b-2 border-violet-400'
                            : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                        title={recentRecords.asOf
                            ? period === 'yesterday'
                                ? recentRecords.asOf
                                : (() => {
                                    const end = new Date(recentRecords.asOf + 'T00:00:00');
                                    const start = new Date(end);
                                    start.setDate(start.getDate() - 6);
                                    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                    return `${fmt(start)} – ${fmt(end)}`;
                                })()
                            : undefined}
                    >
                        {TIME_PERIOD_LABELS[period]}
                    </button>
                ))}
            </div>

            {/* Summary bar — clickable to scroll to section */}
            <div className="px-3 py-2 border-b border-zinc-800 flex gap-4 text-xs shrink-0" aria-live="polite">
                <button
                    onClick={() => highsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    className="hover:underline cursor-pointer transition-colors"
                    style={{ color: HIGH_TEMP_COLOR }}
                >
                    🔥 {highs.length} record high{highs.length !== 1 ? 's' : ''}
                </button>
                <button
                    onClick={() => lowsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    className="hover:underline cursor-pointer transition-colors"
                    style={{ color: LOW_TEMP_COLOR }}
                >
                    ❄️ {lows.length} record low{lows.length !== 1 ? 's' : ''}
                </button>
            </div>

            {/* Sort bar */}
            <div className="px-3 py-2 border-b border-zinc-800 flex items-center gap-2 text-xs shrink-0">
                <span className="text-zinc-400">Sort:</span>
                {RECORD_SORT_OPTIONS.map(opt => (
                    <button
                        key={opt}
                        onClick={() => handleSortChange(opt)}
                        className={`px-2.5 py-1 rounded transition-colors ${sort === opt
                            ? 'bg-zinc-700 text-zinc-100'
                            : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                    >
                        {RECORD_SORT_LABELS[opt]}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1 p-3 space-y-4">
                {records.length === 0 ? (
                    <div className="text-center py-6 space-y-2">
                        <p className="text-zinc-400 text-sm">No records broken {activePeriod === 'yesterday' ? 'yesterday' : 'in the last 7 days'}</p>
                        {activePeriod === 'yesterday' && (
                            <button
                                onClick={() => handlePeriodChange('last7Days')}
                                className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                            >
                                View last 7 days →
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {highs.length > 0 && (
                            <div ref={highsRef}>
                                <h3 className="text-xs font-semibold mb-2" style={{ color: HIGH_TEMP_COLOR }}>
                                    Daily/Monthly Record Highs Broken
                                </h3>
                                <ol className="space-y-0.5">
                                    {highs.slice(0, highsVisible).map((r, i) => (
                                        <RecordRow key={`high-${r.uid}-${r.date}`} record={r} rank={i + 1} sort={sort} useCelsius={useCelsius} onClick={handleRowClick} />
                                    ))}
                                </ol>
                                {highs.length > highsVisible && (
                                    <button
                                        onClick={() => setHighsVisible(v => v + PAGE_SIZE)}
                                        className="w-full mt-2 py-1.5 text-xs text-violet-400 hover:text-violet-300 hover:bg-zinc-800/50 rounded transition-colors"
                                    >
                                        Show more ({(highs.length - highsVisible).toLocaleString()} remaining)
                                    </button>
                                )}
                            </div>
                        )}

                        {lows.length > 0 && (
                            <div ref={lowsRef}>
                                <h3 className="text-xs font-semibold mb-2" style={{ color: LOW_TEMP_COLOR }}>
                                    Daily/Monthly Record Lows Broken
                                </h3>
                                <ol className="space-y-0.5">
                                    {lows.slice(0, lowsVisible).map((r, i) => (
                                        <RecordRow key={`low-${r.uid}-${r.date}`} record={r} rank={i + 1} sort={sort} useCelsius={useCelsius} onClick={handleRowClick} />
                                    ))}
                                </ol>
                                {lows.length > lowsVisible && (
                                    <button
                                        onClick={() => setLowsVisible(v => v + PAGE_SIZE)}
                                        className="w-full mt-2 py-1.5 text-xs text-violet-400 hover:text-violet-300 hover:bg-zinc-800/50 rounded transition-colors"
                                    >
                                        Show more ({(lows.length - lowsVisible).toLocaleString()} remaining)
                                    </button>
                                )}
                            </div>
                        )}
                    </>
                )}

                <p className="text-xs text-zinc-500 pt-2 border-t border-zinc-800">
                    Daily &amp; monthly station records and calendar-date averages begin in 1950 · Data: NOAA/ACIS · Updated {recentRecords.asOf}
                </p>
            </div>
        </div>
    );
}

/* ---------- County records panel ---------- */

type CountySort = 'hottest' | 'coldest' | 'oldest' | 'newest';

const COUNTY_SORT_LABELS: Record<CountySort, string> = {
    hottest: 'Hottest',
    coldest: 'Coldest',
    oldest: 'Oldest',
    newest: 'Newest',
};
const COUNTY_SORT_OPTIONS: CountySort[] = ['hottest', 'coldest', 'oldest', 'newest'];
const COUNTY_PAGE_SIZE = 100;

interface CountyRow {
    countyName: string;
    state: string;
    stationName: string;
    tempF: number;
    date: string;
    year: number;
    type: 'high' | 'low';
    lng: number;
    lat: number;
}

function CountyRecordsPanel({ countyRecords, recordType, onRecordTypeChange, useCelsius, onFlyTo }: { countyRecords?: CountyRecordsCollection | null; recordType: TemperatureRecordType; onRecordTypeChange: (type: TemperatureRecordType) => void; useCelsius: boolean; onFlyTo?: (lng: number, lat: number) => void }) {
    const [sort, setSort] = useState<CountySort>('hottest');
    const [visibleCount, setVisibleCount] = useState(COUNTY_PAGE_SIZE);

    const handleSortChange = (s: CountySort) => { setSort(s); setVisibleCount(COUNTY_PAGE_SIZE); };
    const handleTypeChange = (t: TemperatureRecordType) => { onRecordTypeChange(t); setVisibleCount(COUNTY_PAGE_SIZE); };

    const rows = useMemo(() => {
        if (!countyRecords) return [];
        return countyRecords.features
            .filter(f => f.properties.type === recordType)
            .map(f => {
                const p = f.properties;
                const dateStr = p.date || '';
                const year = dateStr.length >= 4 ? parseInt(dateStr.slice(0, 4), 10) : 1900;
                return {
                    countyName: p.countyName,
                    state: p.state,
                    stationName: p.stationName,
                    tempF: p.tempF,
                    date: dateStr,
                    year: isNaN(year) ? 1900 : year,
                    type: p.type,
                    lng: f.geometry.coordinates[0],
                    lat: f.geometry.coordinates[1],
                } satisfies CountyRow;
            });
    }, [countyRecords, recordType]);

    const sorted = useMemo(() => {
        const copy = [...rows];
        switch (sort) {
            case 'hottest': return copy.sort((a, b) => b.tempF - a.tempF);
            case 'coldest': return copy.sort((a, b) => a.tempF - b.tempF);
            case 'oldest': return copy.sort((a, b) => a.year - b.year);
            case 'newest': return copy.sort((a, b) => b.year - a.year);
        }
    }, [rows, sort]);

    return (
        <div className="absolute bottom-0 left-0 right-0 z-20 max-h-[40dvh] md:bottom-auto md:top-14 md:right-4 md:left-auto md:w-80 md:max-h-[calc(100dvh-6rem)] overflow-hidden flex flex-col bg-zinc-900/90 backdrop-blur md:rounded-lg border-t md:border border-zinc-700/50 text-zinc-200">
            {/* High / Low toggle */}
            <div className="flex border-b border-zinc-700/50 shrink-0">
                {(['high', 'low'] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => handleTypeChange(t)}
                        className={`flex-1 min-w-0 px-3 py-2 text-xs whitespace-nowrap transition-colors ${recordType === t
                            ? 'text-violet-400 border-b-2 border-violet-400'
                            : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                    >
                        {t === 'high' ? '🔥 Record Highs' : '❄️ Record Lows'}
                    </button>
                ))}
            </div>

            {/* Sort bar */}
            <div className="px-3 py-2 border-b border-zinc-800 flex items-center gap-2 text-xs shrink-0">
                <span className="text-zinc-400">Sort:</span>
                {COUNTY_SORT_OPTIONS.map(opt => (
                    <button
                        key={opt}
                        onClick={() => handleSortChange(opt)}
                        className={`px-2.5 py-1 rounded transition-colors ${sort === opt
                            ? 'bg-zinc-700 text-zinc-100'
                            : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                    >
                        {COUNTY_SORT_LABELS[opt]}
                    </button>
                ))}
            </div>

            {/* Count */}
            <div className="px-3 py-1.5 text-xs text-zinc-400 shrink-0" aria-live="polite">
                {sorted.length.toLocaleString()} county all-time {recordType === 'high' ? 'high' : 'low'} records
            </div>

            {/* Content — paginated */}
            <div className="overflow-y-auto flex-1 p-3 pt-0 space-y-0.5">
                {sorted.slice(0, visibleCount).map((r, i) => (
                    <button
                        key={`${r.state}-${r.countyName}-${i}`}
                        onClick={() => onFlyTo?.(r.lng, r.lat)}
                        className="w-full text-left rounded px-1.5 py-1 -mx-1 hover:bg-zinc-800/80 transition-colors cursor-pointer group"
                        title={`${r.countyName}, ${r.state} — click to fly to location`}
                    >
                        <div className="flex items-baseline gap-2 text-xs">
                            <span className="text-zinc-500 w-5 text-right shrink-0">{i + 1}.</span>
                            <span className="font-semibold tabular-nums shrink-0" style={{ color: recordType === 'high' ? HIGH_TEMP_COLOR : LOW_TEMP_COLOR }}>{formatTemp(r.tempF, useCelsius)}</span>
                            <span className="text-zinc-300 truncate group-hover:text-white">{r.countyName}</span>
                            <span className="text-zinc-400 ml-auto shrink-0">{r.year}</span>
                        </div>
                        <div className="flex items-baseline gap-2 text-xs text-zinc-400 ml-7">
                            <span>{r.state}</span>
                            <span className="ml-auto truncate">{r.stationName}</span>
                        </div>
                    </button>
                ))}
                {sorted.length > visibleCount && (
                    <button
                        onClick={() => setVisibleCount(v => v + COUNTY_PAGE_SIZE)}
                        className="w-full mt-2 py-1.5 text-xs text-violet-400 hover:text-violet-300 hover:bg-zinc-800/50 rounded transition-colors"
                    >
                        Show more ({(sorted.length - visibleCount).toLocaleString()} remaining)
                    </button>
                )}
            </div>
        </div>
    );
}

/* ---------- State records panel ---------- */

type StateSort = 'hottest' | 'coldest' | 'oldest' | 'newest' | 'name';

const STATE_SORT_LABELS: Record<StateSort, string> = {
    hottest: 'Hottest',
    coldest: 'Coldest',
    oldest: 'Oldest',
    newest: 'Newest',
    name: 'A–Z',
};
const STATE_SORT_OPTIONS: StateSort[] = ['hottest', 'coldest', 'oldest', 'newest', 'name'];

interface StateRow {
    stateName: string;
    state: string;
    location: string;
    station: string;
    tempF: number;
    date: string;
    year: number;
    type: 'high' | 'low';
    lng: number;
    lat: number;
}

function StateRecordsPanel({ stateRecords, recordType, onRecordTypeChange, useCelsius, onSelectState }: { stateRecords?: StateRecordsCollection | null; recordType: TemperatureRecordType; onRecordTypeChange: (type: TemperatureRecordType) => void; useCelsius: boolean; onSelectState?: (state: string) => void }) {
    const [sort, setSort] = useState<StateSort>('hottest');

    const handleSortChange = (s: StateSort) => setSort(s);
    const handleTypeChange = (t: TemperatureRecordType) => onRecordTypeChange(t);

    const rows = useMemo(() => {
        if (!stateRecords) return [];
        return stateRecords.features
            .filter(f => f.properties.type === recordType)
            .map(f => {
                const p = f.properties;
                const dateStr = p.date || '';
                const year = dateStr.length >= 4 ? parseInt(dateStr.slice(0, 4), 10) : 1900;
                return {
                    stateName: p.stateName,
                    state: p.state,
                    location: p.location,
                    station: p.station,
                    tempF: p.tempF,
                    date: dateStr,
                    year: isNaN(year) ? 1900 : year,
                    type: p.type,
                    lng: f.geometry.coordinates[0],
                    lat: f.geometry.coordinates[1],
                } satisfies StateRow;
            });
    }, [stateRecords, recordType]);

    const sorted = useMemo(() => {
        const copy = [...rows];
        switch (sort) {
            case 'hottest': return copy.sort((a, b) => b.tempF - a.tempF);
            case 'coldest': return copy.sort((a, b) => a.tempF - b.tempF);
            case 'oldest': return copy.sort((a, b) => a.year - b.year);
            case 'newest': return copy.sort((a, b) => b.year - a.year);
            case 'name': return copy.sort((a, b) => a.stateName.localeCompare(b.stateName));
        }
    }, [rows, sort]);

    return (
        <div className="absolute bottom-0 left-0 right-0 z-20 max-h-[40dvh] md:bottom-auto md:top-14 md:right-4 md:left-auto md:w-80 md:max-h-[calc(100dvh-6rem)] overflow-hidden flex flex-col bg-zinc-900/90 backdrop-blur md:rounded-lg border-t md:border border-zinc-700/50 text-zinc-200">
            {/* High / Low toggle */}
            <div className="flex border-b border-zinc-700/50 shrink-0">
                {(['high', 'low'] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => handleTypeChange(t)}
                        className={`flex-1 min-w-0 px-3 py-2 text-xs whitespace-nowrap transition-colors ${recordType === t
                            ? 'text-violet-400 border-b-2 border-violet-400'
                            : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                    >
                        {t === 'high' ? '🔥 Record Highs' : '❄️ Record Lows'}
                    </button>
                ))}
            </div>

            {/* Sort bar */}
            <div className="px-3 py-2 border-b border-zinc-800 flex items-center gap-2 text-xs shrink-0">
                <span className="text-zinc-400">Sort:</span>
                {STATE_SORT_OPTIONS.map(opt => (
                    <button
                        key={opt}
                        onClick={() => handleSortChange(opt)}
                        className={`px-2.5 py-1 rounded transition-colors ${sort === opt
                            ? 'bg-zinc-700 text-zinc-100'
                            : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                    >
                        {STATE_SORT_LABELS[opt]}
                    </button>
                ))}
            </div>

            {/* Count */}
            <div className="px-3 py-1.5 text-xs text-zinc-400 shrink-0" aria-live="polite">
                {sorted.length.toLocaleString()} state all-time {recordType === 'high' ? 'high' : 'low'} records
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1 p-3 pt-0 space-y-0.5">
                {sorted.map((r, i) => (
                    <button
                        key={`${r.state}-${r.type}-${i}`}
                        onClick={() => {
                            onSelectState?.(r.state);
                        }}
                        className="w-full text-left rounded px-1.5 py-1 -mx-1 hover:bg-zinc-800/80 transition-colors cursor-pointer group"
                        title={`${r.stateName} — click to fly to location`}
                    >
                        <div className="flex items-baseline gap-2 text-xs">
                            <span className="text-zinc-500 w-5 text-right shrink-0">{i + 1}.</span>
                            <span className="font-semibold tabular-nums shrink-0" style={{ color: recordType === 'high' ? HIGH_TEMP_COLOR : LOW_TEMP_COLOR }}>{formatTemp(r.tempF, useCelsius)}</span>
                            <span className="text-zinc-300 truncate group-hover:text-white">{r.stateName}</span>
                            <span className="text-zinc-400 ml-auto shrink-0">{r.year}</span>
                        </div>
                        <div className="flex items-baseline gap-2 text-xs text-zinc-400 ml-7">
                            <span>{r.location}</span>
                            <span className="ml-auto truncate">{r.station}</span>
                        </div>
                    </button>
                ))}

                <p className="text-xs text-zinc-500 pt-2 border-t border-zinc-800">
                    Data: NOAA / ACIS · All-time state records
                </p>
            </div>
        </div>
    );
}

/* ---------- Freshness mode panel ---------- */

interface FreshnessPanelProps {
    countyRecords?: CountyRecordsCollection | null;
    recordType: TemperatureRecordType;
    onRecordTypeChange: (type: TemperatureRecordType) => void;
    useCelsius: boolean;
    onFlyTo?: (lng: number, lat: number) => void;
}

interface FreshnessRow {
    countyName: string;
    state: string;
    stationName: string;
    tempF: number;
    year: number;
    color: string;
    lng: number;
    lat: number;
}

const FRESHNESS_PAGE_SIZE = 100;

function FreshnessPanel({ countyRecords, recordType, onRecordTypeChange, useCelsius, onFlyTo }: FreshnessPanelProps) {
    const [sort, setSort] = useState<FreshnessSort>('newest');
    const [visibleCount, setVisibleCount] = useState(FRESHNESS_PAGE_SIZE);

    // Reset pagination when switching type or sort
    const handleSortChange = (s: FreshnessSort) => { setSort(s); setVisibleCount(FRESHNESS_PAGE_SIZE); };
    const handleTypeChange = (t: TemperatureRecordType) => { onRecordTypeChange(t); setVisibleCount(FRESHNESS_PAGE_SIZE); };

    const rows = useMemo(() => {
        if (!countyRecords) return [];
        return countyRecords.features
            .filter(f => f.properties.type === recordType)
            .map(f => {
                const p = f.properties;
                const dateStr = p.date || '';
                const year = dateStr.length >= 4 ? parseInt(dateStr.slice(0, 4), 10) : 1900;
                const safeYear = isNaN(year) ? 1900 : year;
                return {
                    countyName: p.countyName,
                    state: p.state,
                    stationName: p.stationName,
                    tempF: p.tempF,
                    year: safeYear,
                    color: yearToColor(safeYear),
                    lng: f.geometry.coordinates[0],
                    lat: f.geometry.coordinates[1],
                } satisfies FreshnessRow;
            });
    }, [countyRecords, recordType]);

    const sorted = useMemo(() => {
        const copy = [...rows];
        switch (sort) {
            case 'hottest': return copy.sort((a, b) => b.tempF - a.tempF);
            case 'coldest': return copy.sort((a, b) => a.tempF - b.tempF);
            case 'oldest': return copy.sort((a, b) => a.year - b.year);
            case 'newest': return copy.sort((a, b) => b.year - a.year);
        }
    }, [rows, sort]);

    return (
        <div className="absolute bottom-0 left-0 right-0 z-20 max-h-[40dvh] md:bottom-auto md:top-14 md:right-4 md:left-auto md:w-80 md:max-h-[calc(100dvh-6rem)] overflow-hidden flex flex-col bg-zinc-900/90 backdrop-blur md:rounded-lg border-t md:border border-zinc-700/50 text-zinc-200">
            {/* High / Low toggle */}
            <div className="flex border-b border-zinc-700/50 shrink-0">
                {(['high', 'low'] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => handleTypeChange(t)}
                        className={`flex-1 min-w-0 px-3 py-2 text-xs whitespace-nowrap transition-colors ${recordType === t
                            ? 'text-violet-400 border-b-2 border-violet-400'
                            : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                    >
                        {t === 'high' ? '🔥 Record Highs' : '❄️ Record Lows'}
                    </button>
                ))}
            </div>

            {/* Sort bar */}
            <div className="px-3 py-2 border-b border-zinc-800 flex items-center gap-2 text-xs shrink-0">
                <span className="text-zinc-400">Sort:</span>
                {SORT_OPTIONS.map(opt => (
                    <button
                        key={opt}
                        onClick={() => handleSortChange(opt)}
                        className={`px-2.5 py-1 rounded transition-colors ${sort === opt
                            ? 'bg-zinc-700 text-zinc-100'
                            : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                    >
                        {SORT_LABELS[opt]}
                    </button>
                ))}
            </div>

            {/* Count */}
            <div className="px-3 py-1.5 text-xs text-zinc-400 shrink-0" aria-live="polite">
                {sorted.length.toLocaleString()} county all-time {recordType === 'high' ? 'high' : 'low'} records by age
            </div>

            {/* Content — paginated */}
            <div className="overflow-y-auto flex-1 p-3 pt-0 space-y-0.5">
                {sorted.slice(0, visibleCount).map((r, i) => (
                    <FreshnessRowItem key={`${r.state}-${r.countyName}-${i}`} row={r} rank={i + 1} useCelsius={useCelsius} onFlyTo={onFlyTo} />
                ))}
                {sorted.length > visibleCount && (
                    <button
                        onClick={() => setVisibleCount(v => v + FRESHNESS_PAGE_SIZE)}
                        className="w-full mt-2 py-1.5 text-xs text-violet-400 hover:text-violet-300 hover:bg-zinc-800/50 rounded transition-colors"
                    >
                        Show more ({(sorted.length - visibleCount).toLocaleString()} remaining)
                    </button>
                )}
            </div>
        </div>
    );
}

function FreshnessRowItem({ row, rank, useCelsius, onFlyTo }: { row: FreshnessRow; rank: number; useCelsius: boolean; onFlyTo?: (lng: number, lat: number) => void }) {
    return (
        <button
            onClick={() => onFlyTo?.(row.lng, row.lat)}
            className="w-full text-left rounded px-1.5 py-1 -mx-1 hover:bg-zinc-800/80 transition-colors cursor-pointer group"
            title={`${row.countyName}, ${row.state} — click to fly to location`}
        >
            <div className="flex items-baseline gap-2 text-xs">
                <span className="text-zinc-500 w-5 text-right shrink-0">{rank}.</span>
                <span className="font-semibold tabular-nums shrink-0 px-1.5 py-0.5 rounded text-white/90" style={{ backgroundColor: row.color }}>{formatTemp(row.tempF, useCelsius)}</span>
                <span className="text-zinc-300 truncate group-hover:text-white">{row.countyName}</span>
                <span className="text-zinc-400 ml-auto shrink-0">{row.year}</span>
            </div>
            <div className="flex items-baseline gap-2 text-xs text-zinc-400 ml-7">
                <span>{row.state}</span>
                <span className="ml-auto truncate">{row.stationName}</span>
            </div>
        </button>
    );
}

/* ---------- Broken records row (unchanged) ---------- */

function RecordRow({ record, rank, sort, useCelsius, onClick }: { record: BrokenRecord; rank: number; sort: RecordSort; useCelsius: boolean; onClick: (r: BrokenRecord) => void }) {
    const color = record.type === 'high' ? HIGH_TEMP_COLOR : LOW_TEMP_COLOR;
    const margin = getMargin(record);
    const departure = getDeparture(record);
    const arrow = record.type === 'high' ? '↑' : '↓';
    const departureArrow = departure >= 0 ? arrow : record.type === 'high' ? '↓' : '↑';

    const formatMargin = (val: number) =>
        useCelsius ? (val * 5 / 9).toFixed(1) : val.toFixed(1);

    // Secondary info line changes based on sort mode
    const secondaryInfo = (() => {
        switch (sort) {
            case 'temp':
                return (
                    <span style={{ color: color + '99' }}>
                        {arrow}{formatMargin(margin)}° vs prev {formatTemp(record.prevRecordF, useCelsius)} ({record.prevRecordDate.slice(0, 4)})
                    </span>
                );
            case 'margin':
                return (
                    <span style={{ color: color + '99' }}>
                        {arrow}{formatMargin(margin)}° — prev {formatTemp(record.prevRecordF, useCelsius)} ({record.prevRecordDate.slice(0, 4)})
                    </span>
                );
            case 'departure':
                return record.normalF != null ? (
                    <span style={{ color: color + '99' }}>
                        {departureArrow}{formatMargin(Math.abs(departure))}° from {formatComparisonPeriod(record.date)} {formatTemp(record.normalF, useCelsius)}
                    </span>
                ) : (
                    <span className="text-zinc-500">historical average unavailable</span>
                );
        }
    })();

    // Bold metric shown next to temp when sort != 'temp'
    const sortBadge = sort === 'margin'
        ? <span className="text-xs tabular-nums" style={{ color: color + 'cc' }}>+{formatMargin(margin)}°</span>
        : sort === 'departure' && record.normalF != null
            ? <span className="text-xs tabular-nums" style={{ color: color + 'cc' }}>
                {departure >= 0 ? '+' : '−'}{formatMargin(Math.abs(departure))}°
            </span>
            : null;

    return (
        <li>
            <button
                onClick={() => onClick(record)}
                className="w-full text-left rounded px-1.5 py-1 -mx-1 hover:bg-zinc-800/80 transition-colors cursor-pointer group"
                title={`${record.stationName}, ${record.stateName} — click to fly to location`}
            >
                <div className="flex items-baseline gap-2 text-xs">
                    <span className="text-zinc-500 w-4 text-right shrink-0">{rank}.</span>
                    <span className="font-semibold tabular-nums shrink-0" style={{ color }}>{formatTemp(record.tempF, useCelsius)}</span>
                    {sortBadge}
                    <span className="text-zinc-300 truncate group-hover:text-white">{record.stationName}</span>
                    <span className="text-zinc-500 ml-auto shrink-0">{formatShortDate(record.date)}</span>
                </div>
                <div className="flex items-baseline gap-2 text-xs text-zinc-400 ml-6">
                    <span>{record.stateName}</span>
                    <span className="ml-auto">
                        {secondaryInfo}
                    </span>
                </div>
            </button>
        </li>
    );
}

function formatShortDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
