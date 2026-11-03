import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TemperatureDataStatus } from '../features/temperatures/components/TemperatureDataStatus';
import { CONUS_STATES } from '../features/temperatures/constants';
import type { CountyRecordsCollection, RecentRecords } from '../features/temperatures/types';

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('temperature snapshot status', () => {
    it('reports a missing state in any day of a verified seven-day window', () => {
        const dates = Array.from({ length: 7 }, (_, index) => `2026-11-${String(8 - index).padStart(2, '0')}`);
        const recent: RecentRecords = {
            asOf: '2026-11-09', generatedAt: '2026-11-09T07:00:00Z', dates, yesterday: [], last7Days: [],
            coverageByDate: Object.fromEntries(dates.map((date, index) => [date, {
                expectedStates: CONUS_STATES,
                completedStates: index === 3 ? CONUS_STATES.filter(state => state !== 'CA') : CONUS_STATES,
            }])),
        };
        const { rerender } = render(<TemperatureDataStatus viewMode="recent" activePeriod="last7Days" recentRecords={recent} countyRecords={null} stateRecords={null} summary={null} />);
        expect(screen.getByRole('status')).toHaveTextContent('47/48 states · Missing CA');
        expect(screen.getByTitle('Missing states: CA')).toBeInTheDocument();
        rerender(<TemperatureDataStatus viewMode="recent" recentRecords={recent} countyRecords={null} stateRecords={null} summary={null} />);
        expect(screen.getByRole('status')).toHaveTextContent('48/48 states');
    });

    it('uses verified summary coverage when only the trends metadata is loaded', () => {
        render(<TemperatureDataStatus viewMode="freshness" countyRecords={null} recentRecords={null} stateRecords={null}
            summary={{ lastUpdated: '2026-11-03T07:00:00Z', statesProcessed: 48, stateRecordCount: 100, countyRecordCount: 94,
                countyCoverage: { expectedStates: CONUS_STATES, completedStates: CONUS_STATES.filter(state => !['CA', 'OR', 'WA', 'NV'].includes(state)) } }} />);
        expect(screen.getByRole('status')).toHaveTextContent('44/48 states · Missing 4 states');
        expect(screen.getByTitle(/Missing states: CA, NV, OR, WA/)).toBeInTheDocument();
    });

    it('requires Alaska and Hawaii in the state-record view', () => {
        render(<TemperatureDataStatus viewMode="state" countyRecords={null} recentRecords={null} summary={null}
            stateRecords={{ type: 'FeatureCollection', features: [] }} />);
        expect(screen.getByRole('status')).toHaveTextContent('Updated unavailable');
        expect(screen.getByRole('status')).toHaveTextContent('0/50 states');
        expect(screen.getByTitle(/Missing states:.*AK, HI/)).toBeInTheDocument();
    });

    it('updates freshness as time passes and removes its timer on unmount', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-11-03T06:59:30Z'));
        const { unmount } = render(<TemperatureDataStatus viewMode="recent" countyRecords={null} stateRecords={null} summary={null}
            recentRecords={{ asOf: '2026-11-01', generatedAt: '2026-11-01T07:00:00Z', yesterday: [], last7Days: [] }} />);
        expect(screen.getByRole('status')).not.toHaveTextContent('Stale data');
        act(() => vi.advanceTimersByTime(60_000));
        expect(screen.getByRole('status')).toHaveTextContent('Stale data');
        unmount();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('detects missing California from the records despite a summary claiming 48 states', () => {
        const counties: CountyRecordsCollection = { type: 'FeatureCollection', features: CONUS_STATES.filter(state => state !== 'CA').map(state => ({
            type: 'Feature', geometry: { type: 'Point', coordinates: [-100, 39] },
            properties: { state, countyFips: '00000', countyName: 'Test', type: 'high', tempF: 100, date: '2000-01-01', stationName: 'Test', lat: 39, lon: -100 },
        })) };
        render(<TemperatureDataStatus viewMode="county" countyRecords={counties} recentRecords={null} stateRecords={null}
            summary={{ lastUpdated: '2026-11-01T09:00:00Z', statesProcessed: 48, stateRecordCount: 100, countyRecordCount: 94 }} />);
        expect(screen.getByRole('status')).toHaveTextContent('47/48 states · Missing CA');
    });

    it('does not infer verified coverage from a legacy empty record list', () => {
        render(<TemperatureDataStatus viewMode="recent" countyRecords={null} stateRecords={null} summary={null}
            recentRecords={{ asOf: '2026-11-03', dates: ['2026-11-02'], yesterday: [], last7Days: [] }} />);
        expect(screen.getByRole('status')).toHaveTextContent('Coverage unverified');
    });

    it('requires each day to be verified before claiming seven-day coverage', () => {
        const recent: RecentRecords = { asOf: '2026-11-03', dates: ['2026-11-02'], yesterday: [], last7Days: [],
            coverageByDate: { '2026-11-02': { expectedStates: CONUS_STATES, completedStates: CONUS_STATES } } };
        const { rerender } = render(<TemperatureDataStatus viewMode="recent" countyRecords={null} stateRecords={null} summary={null} recentRecords={recent} />);
        expect(screen.getByRole('status')).toHaveTextContent('48/48 states');
        rerender(<TemperatureDataStatus viewMode="recent" activePeriod="last7Days" countyRecords={null} stateRecords={null} summary={null} recentRecords={recent} />);
        expect(screen.getByRole('status')).toHaveTextContent('Coverage unverified');
    });

    it('flags a stale recent snapshot', () => {
        vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-03T12:00:00Z'));
        render(<TemperatureDataStatus viewMode="recent" countyRecords={null} stateRecords={null} summary={null}
            recentRecords={{ asOf: '2026-10-30', yesterday: [], last7Days: [] }} />);
        expect(screen.getByRole('status')).toHaveTextContent('Stale data');
    });
});
