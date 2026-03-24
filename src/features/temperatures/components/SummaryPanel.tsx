import { useState, useMemo } from 'react';
import type { RecentRecords, TimePeriod, BrokenRecord, CountyRecordsCollection, ViewMode } from '../types';
import { TIME_PERIODS, TIME_PERIOD_LABELS, HIGH_TEMP_COLOR, LOW_TEMP_COLOR, yearToColor } from '../constants';

type FreshnessSort = 'hottest' | 'coldest' | 'oldest' | 'newest';

const SORT_LABELS: Record<FreshnessSort, string> = {
    hottest: 'Hottest',
    coldest: 'Coldest',
    oldest: 'Oldest Record',
    newest: 'Newest Record',
};

const SORT_OPTIONS: FreshnessSort[] = ['hottest', 'coldest', 'oldest', 'newest'];

function fToC(f: number): number {
    return (f - 32) * 5 / 9;
}

function formatTemp(tempF: number, useCelsius: boolean): string {
    if (useCelsius) return `${fToC(tempF).toFixed(1)}°C`;
    return `${tempF}°F`;
}

interface SummaryPanelProps {
    viewMode: ViewMode;
    recentRecords?: RecentRecords | null;
    countyRecords?: CountyRecordsCollection | null;
    freshnessType: 'high' | 'low';
    onFreshnessTypeChange: (type: 'high' | 'low') => void;
    useCelsius: boolean;
    onFlyTo?: (lng: number, lat: number) => void;
}

export function SummaryPanel({ viewMode, recentRecords, countyRecords, freshnessType, onFreshnessTypeChange, useCelsius, onFlyTo }: SummaryPanelProps) {
    if (viewMode === 'freshness') {
        return (
            <FreshnessPanel
                countyRecords={countyRecords}
                freshnessType={freshnessType}
                onFreshnessTypeChange={onFreshnessTypeChange}
                useCelsius={useCelsius}
                onFlyTo={onFlyTo}
            />
        );
    }

    if (!recentRecords) return null;

    return <RecordsPanel recentRecords={recentRecords} useCelsius={useCelsius} onFlyTo={onFlyTo} />;
}

/* ---------- Records mode panel (unchanged behavior) ---------- */

function RecordsPanel({ recentRecords, useCelsius, onFlyTo }: { recentRecords: RecentRecords; useCelsius: boolean; onFlyTo?: (lng: number, lat: number) => void }) {
    const [activePeriod, setActivePeriod] = useState<TimePeriod>('yesterday');

    const records = recentRecords[activePeriod] || [];
    const highs = records.filter((r: BrokenRecord) => r.type === 'high').sort((a, b) => b.tempF - a.tempF);
    const lows = records.filter((r: BrokenRecord) => r.type === 'low').sort((a, b) => a.tempF - b.tempF);

    const handleRowClick = (record: BrokenRecord) => {
        if (onFlyTo) onFlyTo(record.lon, record.lat);
    };

    return (
        <div className="absolute top-14 right-4 z-20 w-80 max-h-[calc(100dvh-6rem)] overflow-hidden flex flex-col bg-zinc-900/90 backdrop-blur rounded-lg border border-zinc-700/50 text-zinc-200">
            {/* Tabs */}
            <div className="flex border-b border-zinc-700/50 shrink-0">
                {TIME_PERIODS.map(period => (
                    <button
                        key={period}
                        onClick={() => setActivePeriod(period)}
                        className={`flex-1 min-w-0 px-3 py-2 text-xs whitespace-nowrap transition-colors ${activePeriod === period
                            ? 'text-violet-400 border-b-2 border-violet-400'
                            : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                    >
                        {TIME_PERIOD_LABELS[period]}
                    </button>
                ))}
            </div>

            {/* Summary bar */}
            <div className="px-3 py-2 border-b border-zinc-800 flex gap-4 text-xs shrink-0">
                <span style={{ color: HIGH_TEMP_COLOR }}>🔥 {highs.length} record high{highs.length !== 1 ? 's' : ''}</span>
                <span style={{ color: LOW_TEMP_COLOR }}>❄️ {lows.length} record low{lows.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1 p-3 space-y-4">
                {records.length === 0 ? (
                    <p className="text-zinc-500 text-xs text-center py-4">
                        No records broken {activePeriod === 'yesterday' ? 'yesterday' : 'this week'}
                    </p>
                ) : (
                    <>
                        {highs.length > 0 && (
                            <div>
                                <h3 className="text-xs font-semibold mb-2" style={{ color: HIGH_TEMP_COLOR }}>
                                    Record Highs Broken
                                </h3>
                                <ol className="space-y-0.5">
                                    {highs.map((r, i) => (
                                        <RecordRow key={`high-${r.uid}-${r.date}`} record={r} rank={i + 1} useCelsius={useCelsius} onClick={handleRowClick} />
                                    ))}
                                </ol>
                            </div>
                        )}

                        {lows.length > 0 && (
                            <div>
                                <h3 className="text-xs font-semibold mb-2" style={{ color: LOW_TEMP_COLOR }}>
                                    Record Lows Broken
                                </h3>
                                <ol className="space-y-0.5">
                                    {lows.map((r, i) => (
                                        <RecordRow key={`low-${r.uid}-${r.date}`} record={r} rank={i + 1} useCelsius={useCelsius} onClick={handleRowClick} />
                                    ))}
                                </ol>
                            </div>
                        )}
                    </>
                )}

                <p className="text-[10px] text-zinc-600 pt-2 border-t border-zinc-800">
                    Data: NOAA / ACIS · Records vs 1950–{new Date().getFullYear() - 1} · Updated {recentRecords.asOf}
                </p>
            </div>
        </div>
    );
}

/* ---------- Freshness mode panel ---------- */

interface FreshnessPanelProps {
    countyRecords?: CountyRecordsCollection | null;
    freshnessType: 'high' | 'low';
    onFreshnessTypeChange: (type: 'high' | 'low') => void;
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

function FreshnessPanel({ countyRecords, freshnessType, onFreshnessTypeChange, useCelsius, onFlyTo }: FreshnessPanelProps) {
    const [sort, setSort] = useState<FreshnessSort>('newest');

    const rows = useMemo(() => {
        if (!countyRecords) return [];
        return countyRecords.features
            .filter(f => f.properties.type === freshnessType)
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
    }, [countyRecords, freshnessType]);

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
        <div className="absolute top-14 right-4 z-20 w-80 max-h-[calc(100dvh-6rem)] overflow-hidden flex flex-col bg-zinc-900/90 backdrop-blur rounded-lg border border-zinc-700/50 text-zinc-200">
            {/* High / Low toggle */}
            <div className="flex border-b border-zinc-700/50 shrink-0">
                {(['high', 'low'] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => onFreshnessTypeChange(t)}
                        className={`flex-1 min-w-0 px-3 py-2 text-xs whitespace-nowrap transition-colors ${freshnessType === t
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
                <span className="text-zinc-500">Sort:</span>
                {SORT_OPTIONS.map(opt => (
                    <button
                        key={opt}
                        onClick={() => setSort(opt)}
                        className={`px-2 py-0.5 rounded transition-colors ${sort === opt
                            ? 'bg-zinc-700 text-zinc-100'
                            : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                    >
                        {SORT_LABELS[opt]}
                    </button>
                ))}
            </div>

            {/* Count */}
            <div className="px-3 py-1.5 text-[10px] text-zinc-500 shrink-0">
                {sorted.length.toLocaleString()} county {freshnessType === 'high' ? 'high' : 'low'} records
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1 p-3 pt-0 space-y-0.5">
                {sorted.map((r, i) => (
                    <FreshnessRowItem key={`${r.state}-${r.countyName}-${i}`} row={r} rank={i + 1} useCelsius={useCelsius} onFlyTo={onFlyTo} />
                ))}
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
                <span className="text-zinc-600 w-5 text-right shrink-0">{rank}.</span>
                <span className="font-semibold tabular-nums shrink-0" style={{ color: row.color }}>{formatTemp(row.tempF, useCelsius)}</span>
                <span className="text-zinc-300 truncate group-hover:text-white">{row.countyName}</span>
                <span className="text-zinc-500 ml-auto shrink-0">{row.year}</span>
            </div>
            <div className="flex items-baseline gap-2 text-[10px] text-zinc-500 ml-7">
                <span>{row.state}</span>
                <span className="ml-auto truncate">{row.stationName}</span>
            </div>
        </button>
    );
}

/* ---------- Broken records row (unchanged) ---------- */

function RecordRow({ record, rank, useCelsius, onClick }: { record: BrokenRecord; rank: number; useCelsius: boolean; onClick: (r: BrokenRecord) => void }) {
    const color = record.type === 'high' ? HIGH_TEMP_COLOR : LOW_TEMP_COLOR;
    const margin = record.type === 'high'
        ? record.tempF - record.prevRecordF
        : record.prevRecordF - record.tempF;
    const arrow = record.type === 'high' ? '↑' : '↓';

    return (
        <li>
            <button
                onClick={() => onClick(record)}
                className="w-full text-left rounded px-1.5 py-1 -mx-1 hover:bg-zinc-800/80 transition-colors cursor-pointer group"
                title={`${record.stationName}, ${record.stateName} — click to fly to location`}
            >
                <div className="flex items-baseline gap-2 text-xs">
                    <span className="text-zinc-600 w-4 text-right shrink-0">{rank}.</span>
                    <span className="font-semibold tabular-nums shrink-0" style={{ color }}>{formatTemp(record.tempF, useCelsius)}</span>
                    <span className="text-zinc-300 truncate group-hover:text-white">{record.stationName}</span>
                    <span className="text-zinc-600 ml-auto shrink-0">{formatShortDate(record.date)}</span>
                </div>
                <div className="flex items-baseline gap-2 text-[10px] text-zinc-500 ml-6">
                    <span>{record.stateName}</span>
                    <span className="ml-auto" style={{ color: color + '99' }}>
                        {arrow}{useCelsius ? (margin * 5 / 9).toFixed(1) : margin.toFixed(1)}° vs prev {formatTemp(record.prevRecordF, useCelsius)} ({record.prevRecordDate.slice(0, 4)})
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
