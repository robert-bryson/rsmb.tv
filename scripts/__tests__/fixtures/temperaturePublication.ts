import { vi } from 'vitest';
import { usStates } from '../../../shared/geography/usStates';
import type { z } from 'zod';
import type { recentRecordsSchema } from '../../../shared/temperatureSchemas';

type BrokenRecord = z.infer<typeof recentRecordsSchema>['last7Days'][number];

const states = usStates.filter(state => state.abbr !== 'AK' && state.abbr !== 'HI').map(state => state.abbr);
export const asOf = '2026-11-09';
export const generatedAt = '2026-11-09T17:00:00Z';

export function fixture() {
    const county = { type: 'FeatureCollection', features: states.flatMap(state => ['high', 'low'].map(type => ({
        type: 'Feature', geometry: { type: 'Point', coordinates: [-100, 39] }, properties: {
            countyFips: usStates.find(item => item.abbr === state)!.fips + '001', countyName: 'Test County', state, type, tempF: type === 'high' ? 100 : 0,
            date: '2000-01-01', stationName: 'Test', lat: 39, lon: -100,
        },
    }))) };
    const state = { type: 'FeatureCollection', features: usStates.flatMap(({ abbr, name }) => ['high', 'low'].map(type => ({
        type: 'Feature', geometry: { type: 'Point', coordinates: [-100, 39] },
        properties: { state: abbr, stateName: name, type, tempF: type === 'high' ? 120 : 0, date: '2000-01-01', location: 'Test', station: 'Test' },
    }))) };
    const dates = ['2026-11-08', '2026-11-07', '2026-11-06', '2026-11-05', '2026-11-04', '2026-11-03', '2026-11-02'];
    const coverage = { expectedStates: [...states], completedStates: [...states] };
    return {
        'countyRecords.json': county,
        'stateRecords.json': state,
        'recentRecords.json': {
            asOf, generatedAt, monthlyThresholdVersion: 2, dates,
            coverageByDate: Object.fromEntries(dates.map(date => [date, structuredClone(coverage)])),
            yesterday: [] as BrokenRecord[], last7Days: [] as BrokenRecord[],
        },
        'summary.json': { lastUpdated: generatedAt, stateRecordCount: state.features.length, countyRecordCount: county.features.length, statesProcessed: 48, countyCoverage: coverage },
        'climateTrends.json': {
            source: 'fixture', description: 'Standing county records', totalHighs: 48, totalLows: 48,
            byYear: Array.from({ length: 137 }, (_, index) => ({ year: 1890 + index, highs: index === 110 ? 48 : 0, lows: index === 110 ? 48 : 0 })),
            byDecade: Array.from({ length: 14 }, (_, index) => ({
                decade: 1890 + index * 10, label: `${1890 + index * 10}s`,
                highs: index === 11 ? 48 : 0, lows: index === 11 ? 48 : 0, ratio: index === 11 ? 1 : null,
            })),
            rollingRatio: Array.from({ length: 128 }, (_, index) => ({
                year: 1899 + index, highs10yr: index >= 101 && index <= 110 ? 48 : 0,
                lows10yr: index >= 101 && index <= 110 ? 48 : 0, ratio: index >= 101 && index <= 110 ? 1 : null,
            })),
        },
    };
}

export function reader(data = fixture()) {
    return vi.fn(async (url: URL) => Response.json(data[url.pathname.split('/').at(-1)! as keyof typeof data]));
}
