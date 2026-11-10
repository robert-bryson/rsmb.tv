import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SummaryPanel } from '../features/temperatures/components/SummaryPanel';
import type { BrokenRecord, RecentRecords } from '../features/temperatures/types';

const record: BrokenRecord = {
    stationName: 'Test Station', uid: 1, state: 'TX', stateName: 'Texas', county: '48001',
    lat: 31.5, lon: -99.3, elev: 100, type: 'low', tempF: 30, prevRecordF: 31,
    prevRecordDate: '2011-09-02', normalF: 25, date: '2026-09-02', recordScope: 'daily',
};

function recentRecords(records: BrokenRecord[]): RecentRecords {
    return {
        asOf: '2026-09-03',
        yesterday: records,
        last7Days: records,
    };
}

function renderSummary(records = [record]) {
    return render(
        <main>
            <h1>U.S. Temperature Records</h1>
            <SummaryPanel
                viewMode="recent"
                recentRecords={recentRecords(records)}
                recordType="low"
                onRecordTypeChange={vi.fn()}
                useCelsius={false}
                activePeriod="yesterday"
                onPeriodChange={vi.fn()}
            />
        </main>,
    );
}

describe('temperature summary panel', () => {
    it('shows the correct direction when a record low is warmer than its average', () => {
        renderSummary();

        expect(screen.getByText(/↑5\.0° from 1950–2025 avg 25°F/)).toBeInTheDocument();
        expect(screen.queryByText(/↓-5\.0°/)).not.toBeInTheDocument();
    });

    it('places both populated record sections directly below the page heading', () => {
        renderSummary([record, { ...record, uid: 2, type: 'high', tempF: 100, prevRecordF: 99 }]);
        expect(screen.getByRole('heading', { name: 'Daily/Monthly Record Highs Broken', level: 2 })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Daily/Monthly Record Lows Broken', level: 2 })).toBeInTheDocument();
    });
});
