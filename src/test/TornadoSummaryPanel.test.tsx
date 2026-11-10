import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TornadoSummaryPanel } from '../features/tornadoes/components/TornadoSummaryPanel';
import type { AnnualTornadoSummary, AnnualWarningSummary } from '../features/tornadoes/types';

function annual(year: number, count: number, deaths: number, ef2Plus: number): AnnualTornadoSummary {
    return { year, count, deaths, ef2Plus, unknown: 0, ef0: count - ef2Plus, ef1: 0, ef2: ef2Plus, ef3: 0, ef4: 0, ef5: 0,
        ef1Plus: ef2Plus, injuries: 0, trackMiles: 0, medianWidthYards: 0 };
}

function props(overrides: Partial<ComponentProps<typeof TornadoSummaryPanel>> = {}): ComponentProps<typeof TornadoSummaryPanel> {
    return {
        stats: { count: 10, deaths: 2, injuries: 0, trackMiles: 0, ef2Plus: 3, strongestScale: 2 },
        stateBreakdown: [{ state: 'KS', stateName: 'Kansas', count: 10, deaths: 2, ef2Plus: 3, ef2Pct: 30 }],
        selectedTrack: null, notableEvents: [], annualSummary: [annual(2023, 10, 2, 3), annual(2024, 0, 0, 0), annual(2026, 99, 99, 99)],
        trendsLoading: false, trendsError: null, onRetryTrends: vi.fn(), warningSummary: null, warningLoading: false, warningError: null,
        densityAvailable: true, mobileOpen: false, onMobileClose: vi.fn(), startYear: 2023, endYear: 2023,
        scaleFilter: 'all', region: 'conus', colorMode: 'scale', mode: 'trends', selectedState: null, selectedStateName: null, shareCopied: false,
        onScaleFilterChange: vi.fn(), onRegionChange: vi.fn(), onSelectedStateChange: vi.fn(), onColorModeChange: vi.fn(),
        onModeChange: vi.fn(), onSelectEvent: vi.fn(), onShare: vi.fn(), onCloseSelection: vi.fn(), resultsReady: true, onResetFilters: vi.fn(),
        ...overrides,
    };
}

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-09T12:00:00Z')); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('tornado accessible controls and chart data', () => {
    it('provides a focusable native state selector, including offscreen jurisdictions', () => {
        const options = props();
        render(<TornadoSummaryPanel {...options} />);
        const state = screen.getByRole('combobox', { name: 'State' });
        state.focus();
        expect(state).toHaveFocus();
        expect(within(state).getByRole('option', { name: 'Puerto Rico' })).toHaveValue('PR');
        fireEvent.change(state, { target: { value: 'KS' } });
        expect(options.onSelectedStateChange).toHaveBeenCalledExactlyOnceWith('KS');
        expect(options.onModeChange).not.toHaveBeenCalled();
    });

    it('offers reset only for a completed empty result', () => {
        const options = props();
        options.stats = { ...options.stats, count: 0 };
        const { rerender } = render(<TornadoSummaryPanel {...options} resultsReady={false} />);
        expect(screen.queryByRole('button', { name: 'Reset filters' })).not.toBeInTheDocument();
        rerender(<TornadoSummaryPanel {...options} />);
        fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
        expect(options.onResetFilters).toHaveBeenCalledOnce();
        expect(screen.getByRole('complementary', { name: 'Tornado controls and details' })).toHaveFocus();
    });

    it('exposes annual values, zero-count years and selection boundaries while excluding the incomplete year', () => {
        render(<TornadoSummaryPanel {...props()} />);
        fireEvent.click(screen.getByText('View annual track data'));
        const table = screen.getByRole('table', { name: 'Annual track data' });
        expect(within(table).getByRole('columnheader', { name: 'Deaths per 100 segments' })).toBeVisible();
        expect(within(table).getByRole('row', { name: '2023 10 3 2 20.0 Yes' })).toBeVisible();
        expect(within(table).getByRole('row', { name: '2024 0 0 0 0.0 No' })).toBeVisible();
        expect(within(table).queryByRole('rowheader', { name: '2026' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByText('View decade comparison data'));
        expect(within(screen.getByRole('table', { name: 'Decade comparison data' })).getByRole('row', { name: /5\.0 1\.0 30\.0 20\.0/ })).toBeVisible();
        fireEvent.click(screen.getByText('View top states data'));
        expect(within(screen.getByRole('table', { name: 'Top states data' })).getByRole('row', { name: 'Kansas 10 30.0 2' })).toBeVisible();
    });

    it('exposes independent national warning and office totals', () => {
        const warning: AnnualWarningSummary = { year: 2023, warnings: 20, tornadoWarnings: 8, severeThunderstormWarnings: 12,
            emergencyWarnings: 0, matchedWarnings: 5, tornadoMatchedWarnings: 2, severeThunderstormMatchedWarnings: 3, warningAreaKm2: 0,
            watches: 4, tornadoWatches: 1, severeThunderstormWatches: 3, pdsWatches: 0, matchedWatches: 2, tornadoMatchedWatches: 1, severeThunderstormMatchedWatches: 1 };
        render(<TornadoSummaryPanel {...props({ selectedState: 'KS', warningSummary: { source: 'fixture',
            availability: { stormBasedWarningsStartYear: 2002, spcWatchStartYear: 1997, reportMatchMethod: 'fixture' },
            annual: [warning, { ...warning, year: 2026, warnings: 999 }], wfoYear: [{ ...warning, wfo: 'TOP' }],
        } })} />);
        fireEvent.click(screen.getByText('View annual national warning data'));
        const table = screen.getByRole('table', { name: 'Annual national warning data' });
        expect(within(table).getByRole('row', { name: '2023 20 8 5 4 2 Yes' })).toBeVisible();
        expect(within(table).queryByRole('rowheader', { name: '2026' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByText('View weather office warning data'));
        expect(within(screen.getByRole('table', { name: 'Weather office warning data' })).getByRole('row', { name: 'TOP 20 8 5' })).toBeVisible();
    });
});
