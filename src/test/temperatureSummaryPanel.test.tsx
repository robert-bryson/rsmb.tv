import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SummaryPanel } from '../features/temperatures/components/SummaryPanel';
import type { BrokenRecord, RecentRecords } from '../features/temperatures/types';

function recentRecords(record: BrokenRecord): RecentRecords {
    return {
        asOf: '2026-09-03',
        yesterday: [record],
        last7Days: [record],
    };
}

describe('temperature summary panel', () => {
    it('shows the correct direction when a record low is warmer than its average', () => {
        render(
            <SummaryPanel
                viewMode="recent"
                recentRecords={recentRecords({
                    stationName: 'Test Station',
                    uid: 1,
                    state: 'TX',
                    stateName: 'Texas',
                    county: '48001',
                    lat: 31.5,
                    lon: -99.3,
                    elev: 100,
                    type: 'low',
                    tempF: 30,
                    prevRecordF: 31,
                    prevRecordDate: '2011-09-02',
                    normalF: 25,
                    date: '2026-09-02',
                    recordScope: 'daily',
                })}
                recordType="low"
                onRecordTypeChange={vi.fn()}
                useCelsius={false}
                activePeriod="yesterday"
                onPeriodChange={vi.fn()}
            />,
        );

        expect(screen.getByText(/↑5\.0° from 1950–2025 avg 25°F/)).toBeInTheDocument();
        expect(screen.queryByText(/↓-5\.0°/)).not.toBeInTheDocument();
    });
});