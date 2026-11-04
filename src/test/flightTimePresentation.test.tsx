import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FlightDurationDetail } from '../features/flights/components/DurationSummary';
import { HoverInfo } from '../features/flights/components/HoverInfo';
import { MobileInfoOverlay } from '../features/flights/components/MobileInfoOverlay';
import { FlightTimeValue } from '../features/flights/components/shared/FlightTimeValue';
import type { FlightProperties, GlobePoint, GlobeStatePolygon, GlobeStaticArc } from '../features/flights/types';
import { resolveFlightDuration, summarizeFlightDurations } from '../features/flights/utils/flightDuration';
import { buildArcLabelHtml, buildPointLabelHtml, buildStatePolygonLabelHtml } from '../features/flights/utils/tooltipHtml';
import { makeAirport, makeFlight } from './helpers/flights';

const missing = makeFlight({ durationMinutes: null, durationKind: null, durationSource: null, origin_lat: NaN });
const fallback = makeFlight({ durationMinutes: null, durationKind: null, durationSource: null });
const removedNotes = /Est\.|Estimated|\d+ actual ·|Gate-to-gate|Distance estimate/;

function arc(flights: FlightProperties[]): GlobeStaticArc & { isStatic: true } {
    return {
        startLat: 47.45, startLng: -122.31, endLat: 33.94, endLng: -118.41,
        color: 'purple', stroke: 1, routeKey: 'LAX-SEA', routeCount: flights.length,
        flights, isConnected: false, isStatic: true,
    };
}

function tooltip(html: string) {
    const element = document.createElement('div');
    element.innerHTML = html;
    return element;
}

function summaryTooltips(flights: FlightProperties[]) {
    const duration = summarizeFlightDurations(flights);
    const point: GlobePoint = {
        lat: 47.45, lng: -122.31, size: 1, color: 'gold', label: 'SEA',
        airport: makeAirport('SEA', { duration }),
    };
    const state: GlobeStatePolygon = {
        geometry: { type: 'Polygon', coordinates: [] },
        properties: { code: 'US-WA', name: 'Washington', abbr: 'WA' }, color: 'blue',
        stats: {
            code: 'US-WA', name: 'Washington', abbr: 'WA', visited: true,
            airportCount: 1, totalAirports: 2, flightCount: flights.length,
            firstVisitDate: null, lastVisitDate: null, airlines: [], duration,
        },
    };
    return [
        tooltip(buildArcLabelHtml(arc(flights), null)),
        tooltip(buildArcLabelHtml(arc(flights), 'LAX-SEA')),
        tooltip(buildPointLabelHtml(point, true)),
        tooltip(buildStatePolygonLabelHtml(state)),
    ];
}

describe('flight time presentation across renderers', () => {
    it('shows years instead of full dates in desktop and mobile route details', () => {
        const flights = [
            makeFlight({ date: '2025-12-31' }),
            makeFlight({ id: 2, date: '5/14/2022' }),
            makeFlight({ id: 3, date: '5/26/2022' }),
        ];
        const { container } = render(<MobileInfoOverlay arc={arc(flights)} onClose={() => {}} onSelect={() => {}} />);
        expect(container).toHaveTextContent('Years: 2025, 2022');
        for (const html of [container.innerHTML, buildArcLabelHtml(arc(flights), null), buildArcLabelHtml(arc(flights), 'LAX-SEA')]) {
            expect(html).toContain('2022');
            expect(html).toContain('2025');
            for (const flight of flights) expect(html).not.toContain(flight.date);
        }
    });

    it('keeps the newest distinct years when mobile and desktop summaries truncate a route', () => {
        const flights = [2021, 2026, 2023, 2025, 2024, 2022, 2026].map((year, id) => makeFlight({ id, date: `1/1/${year}` }));
        const { container } = render(<MobileInfoOverlay arc={arc(flights)} onClose={() => {}} onSelect={() => {}} />);
        expect(container).toHaveTextContent('Years: 2026, 2025, 2024...');
        expect(tooltip(buildArcLabelHtml(arc(flights), null))).toHaveTextContent('Years: 2026, 2025, 2024, 2023, 2022...');
    });

    it.each(['actual-block', 'scheduled-block'] as const)('retains and escapes %s source details in React and HTML', durationKind => {
        const source = '<img src=x onerror=alert(1)> & "evidence"';
        const flight = makeFlight({ durationMinutes: 125, durationKind, durationSource: source });
        const { container } = render(<FlightDurationDetail flight={flight} />);
        const html = tooltip(buildArcLabelHtml(arc([flight]), 'LAX-SEA'));

        for (const element of [container, html]) {
            expect(within(element).getByText('2h 05m')).toHaveAttribute('aria-hidden', 'true');
            expect(within(element).getByText('2 hours 5 minutes')).toHaveClass('sr-only');
            expect(element).toHaveTextContent(`Source: ${source}`);
            expect(element).toHaveTextContent(durationKind === 'actual-block' ? 'Actual' : 'Scheduled');
            expect(element.querySelector('img, script')).toBeNull();
            expect(element).not.toHaveTextContent(removedNotes);
        }
    });

    it.each([
        { name: 'supplied estimate', flight: makeFlight({ durationMinutes: 125, durationKind: 'estimated-block', durationSource: 'custom model' }) },
        { name: 'distance fallback', flight: fallback },
    ])('shows the $name time without estimate metadata in React and HTML', ({ flight }) => {
        const { container } = render(<FlightDurationDetail flight={flight} />);
        const html = tooltip(buildArcLabelHtml(arc([flight]), 'LAX-SEA'));

        for (const element of [container, html]) {
            expect(element.querySelector('[aria-hidden="true"]')).toHaveTextContent(/\dh/);
            expect(element.querySelector('.sr-only')).toHaveTextContent(/hours?/);
            expect(element).not.toHaveTextContent(removedNotes);
            expect(element).not.toHaveTextContent(/Source:|custom model| · /);
        }
        expect(resolveFlightDuration(flight).kind).toBe('estimated-block');
        expect(resolveFlightDuration(flight).source).toBeTruthy();
    });

    it('retains unknown-basis reported time and safely displays its source in both renderers', () => {
        const flight = makeFlight({ durationMinutes: 40, durationKind: 'unclassified', durationSource: '<script>old log</script>' });
        const { container } = render(<FlightDurationDetail flight={flight} />);
        const html = tooltip(buildArcLabelHtml(arc([flight]), 'LAX-SEA'));

        for (const element of [container, html]) {
            expect(element).toHaveTextContent('40m');
            expect(element).toHaveTextContent('source: <script>old log</script>');
            expect(element.querySelector('script')).toBeNull();
            expect(element).not.toHaveTextContent(removedNotes);
        }
    });

    it('keeps an unavailable reported flight distinct from usable time in both renderers', () => {
        const flight = makeFlight({ ...missing, durationMinutes: 40, durationKind: 'unclassified', durationSource: 'old log' });
        const { container } = render(<FlightDurationDetail flight={flight} />);
        const html = tooltip(buildArcLabelHtml(arc([flight]), 'LAX-SEA'));
        for (const element of [container, html]) {
            expect(element).toHaveTextContent('Flight time unavailable');
            expect(element).toHaveTextContent('40m');
            expect(element).toHaveTextContent('source: old log');
        }
    });

    it.each([
        { name: 'actual', flights: [makeFlight({ durationMinutes: 125 })], hours: '2.1 h' },
        { name: 'scheduled', flights: [makeFlight({ durationMinutes: 125, durationKind: 'scheduled-block' })], hours: '2.1 h' },
        { name: 'supplied estimate', flights: [makeFlight({ durationMinutes: 125, durationKind: 'estimated-block' })], hours: '2.1 h' },
        { name: 'mixed', flights: [makeFlight({ durationMinutes: 125 }), makeFlight({ durationMinutes: 55, durationKind: 'scheduled-block' })], hours: '3 h' },
    ])('keeps $name route, airport, and state tooltip totals consistent', ({ flights, hours }) => {
        for (const element of summaryTooltips(flights)) {
            expect(element).toHaveTextContent(hours);
            expect(element).not.toHaveTextContent(removedNotes);
            expect(element).not.toHaveTextContent('Time available for');
        }
    });

    it('retains partial-total context in compact hover and spoken text', () => {
        render(<FlightTimeValue summary={summarizeFlightDurations([makeFlight({ durationMinutes: 125 }), missing])} />);
        const value = screen.getByText('2h').parentElement;
        expect(value).toHaveAttribute('title', 'Flight time: 2.1 h. Time available for 1 of 2 flights.');
        expect(screen.getByText('Flight time: 2 hours 5 minutes. Time available for 1 of 2 flights.')).toHaveClass('sr-only');
        expect(value).not.toHaveTextContent(removedNotes);
    });

    it('retains partial-total context in route, airport, and state tooltips', () => {
        for (const element of summaryTooltips([makeFlight({ durationMinutes: 125 }), missing])) {
            expect(element).toHaveTextContent('2.1 h');
            expect(element).toHaveTextContent('1 of 2 flights');
            expect(element).not.toHaveTextContent(removedNotes);
        }
    });

    it('keeps an empty static route tooltip empty', () => {
        expect(buildArcLabelHtml(arc([]), null)).toBe('');
    });

    it('shows unavailable route, airport, and state time without zero totals or estimate metadata', () => {
        for (const element of summaryTooltips([missing])) {
            expect(element).toHaveTextContent(/flight time unavailable/i);
            expect(element).not.toHaveTextContent(/\b0 h\b/);
            expect(element).not.toHaveTextContent(removedNotes);
            expect(element).not.toHaveTextContent('Time available for');
        }
    });

    it('keeps the hover preview current when all available times disappear', () => {
        const { rerender } = render(<HoverInfo hoveredArc={arc([makeFlight({ durationMinutes: 125 })])} hoveredPoint={null} />);
        expect(screen.getByRole('tooltip')).toHaveTextContent('Flight time: 2.1 h');
        rerender(<HoverInfo hoveredArc={arc([missing])} hoveredPoint={null} />);
        expect(screen.getByRole('tooltip')).toHaveTextContent('Flight time unavailable');
        expect(screen.getByRole('tooltip')).not.toHaveTextContent('2.1 h');
    });
});
