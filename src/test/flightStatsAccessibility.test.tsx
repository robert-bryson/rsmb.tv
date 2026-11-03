import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CollapsibleSection } from '../features/flights/components/shared/CollapsibleSection';
import { FlightTimeValue } from '../features/flights/components/shared/FlightTimeValue';
import { DurationSummary } from '../features/flights/components/DurationSummary';
import { BottomStatsBar } from '../features/flights/components/BottomStatsBar';
import { summarizeFlightDurations } from '../features/flights/utils/flightDuration';
import { makeFlight } from './helpers/flights';

describe('flight statistics accessibility', () => {
    it('exposes disclosure state and a stable content target without submitting its enclosing form', () => {
        const onSubmit = vi.fn(event => event.preventDefault());
        render(<form onSubmit={onSubmit}>
            <CollapsibleSection title="Flight Time" icon="🕒"><p>Recorded time</p></CollapsibleSection>
        </form>);
        const toggle = screen.getByRole('button', { name: 'Flight Time' });
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        const content = document.getElementById(toggle.getAttribute('aria-controls')!);
        expect(content).toContainElement(screen.getByText('Recorded time'));
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(content).not.toBeVisible();
        expect(onSubmit).not.toHaveBeenCalled();
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(content).toContainElement(screen.getByText('Recorded time'));
    });

    it('reflects controlled state and keeps content IDs unique across sections', () => {
        const onToggle = vi.fn();
        const { rerender } = render(<>
            <CollapsibleSection title="Time" isOpen={false} onToggle={onToggle}>First</CollapsibleSection>
            <CollapsibleSection title="Distance">Second</CollapsibleSection>
        </>);
        const toggle = screen.getByRole('button', { name: 'Time' });
        const target = toggle.getAttribute('aria-controls');
        expect(target).toBeTruthy();
        expect(target).not.toBe(screen.getByRole('button', { name: 'Distance' }).getAttribute('aria-controls'));
        fireEvent.click(toggle);
        expect(onToggle).toHaveBeenCalledOnce();
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        rerender(<CollapsibleSection title="Time" isOpen onToggle={onToggle}>First</CollapsibleSection>);
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(toggle).toHaveAttribute('aria-controls', target);
        expect(screen.getByText('First')).toBeVisible();
    });

    it('makes timing provenance and the estimate method visible without hover', () => {
        const summary = summarizeFlightDurations([
            makeFlight({ durationMinutes: 65 }),
            makeFlight({ durationMinutes: 80, durationKind: 'scheduled-block' }),
            makeFlight({ durationMinutes: 40, durationKind: 'unclassified', durationSource: 'old log' }),
            makeFlight({ durationMinutes: null, durationKind: null, durationSource: null, origin_lat: NaN }),
        ]);
        render(<DurationSummary summary={summary} />);
        const region = screen.getByRole('region', { name: 'Flight time' });
        expect(within(region).getByText('1 actual · 1 scheduled · 1 estimated · 1 unavailable · 1 reported, timing basis unknown')).toBeVisible();
        expect(within(region).getByText('Gate-to-gate. Estimates use distance and a fixed allowance.')).toBeVisible();
        const details = within(region).getByText(/^Est\. flight time:/);
        expect(details).toHaveClass('sr-only');
        expect(details).toHaveTextContent('1 actual · 1 scheduled · 1 estimated · 1 unavailable · 1 reported, timing basis unknown');
        expect(details.parentElement).toHaveAttribute('title', expect.stringContaining('Gate-to-gate. Estimates use distance and a fixed allowance.'));
        expect(region).toHaveTextContent('3 of 4 flights');
    });

    it('exposes precise time and coverage as readable text for assistive technology', () => {
        const summary = summarizeFlightDurations([
            makeFlight({ durationMinutes: 165 }),
            makeFlight({ durationMinutes: 180, durationKind: 'scheduled-block' }),
        ]);
        render(<FlightTimeValue summary={summary} />);
        expect(screen.getByText('6h')).toHaveAttribute('aria-hidden', 'true');
        expect(screen.getByText('6h').parentElement).toHaveAttribute('title', expect.stringContaining('Est. flight time: 5.8 h'));
        const spoken = screen.getByText(/^Est\. flight time: 5 hours 45 minutes\./);
        expect(spoken).toHaveClass('sr-only');
        expect(spoken).toHaveTextContent('1 actual · 1 scheduled · 0 estimated');
    });

    it.each([false, true])('retains useful unavailable wording for an empty or unusable summary (%s)', unusable => {
        const summary = summarizeFlightDurations(unusable
            ? [makeFlight({ durationMinutes: null, durationKind: null, durationSource: null, origin_lat: NaN })]
            : []);
        render(<FlightTimeValue summary={summary} />);
        expect(screen.getByText('Unavailable')).toHaveAttribute('aria-hidden', 'true');
        expect(screen.getByText(/^Flight time unavailable\./)).toHaveClass('sr-only');
        expect(screen.queryByText(/0 h/)).not.toBeInTheDocument();
    });

    it.each(['actual-block', 'scheduled-block'] as const)('keeps compact status totals readable for %s time', durationKind => {
        const summary = summarizeFlightDurations([makeFlight({ durationMinutes: 165, durationKind })]);
        render(<BottomStatsBar
            totalFlights={1} totalAirports={2} totalDistance={1500} duration={summary}
            selectedYear={null} selectedAirport={null} selectedAirline={null}
            selectedCountry={null} selectedRegion={null} selectedFlightType={null}
            isMetric onToggleUnits={vi.fn()}
        />);
        const status = screen.getByRole('status');
        expect(within(status).getByText('3h')).toHaveAttribute('aria-hidden', 'true');
        expect(within(status).getByText(/flight time: 2 hours 45 minutes\./i)).toHaveClass('sr-only');
        if (durationKind === 'scheduled-block') expect(within(status).getByText('Est.')).toBeVisible();
        else expect(within(status).queryByText('Est.')).not.toBeInTheDocument();
    });
});
