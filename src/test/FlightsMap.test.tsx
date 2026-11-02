import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FlightsMap } from '../features/flights/components/FlightsMap';
import type { AirportsCollection, FlightsCollection, GlobeStaticArc } from '../features/flights/types';
import { makeAirport, makeFlight } from './helpers/flights';

const flights: FlightsCollection = {
    type: 'FeatureCollection',
    features: [
        makeFlight({ durationMinutes: 165 }),
        makeFlight({ id: 2, date: '1/1/2025', durationMinutes: 240, durationKind: 'scheduled-block' }),
        makeFlight({ id: 3, date: '1/1/2026', destination_code: 'BFI' }),
    ].map(properties => ({ type: 'Feature', properties, geometry: { type: 'LineString', coordinates: [] } })),
};
const airports: AirportsCollection = {
    type: 'FeatureCollection',
    features: [makeAirport('SEA'), makeAirport('LAX'), makeAirport('BFI')]
        .map(properties => ({ type: 'Feature', properties, geometry: { type: 'Point', coordinates: [0, 0] } })),
};

// Keep application state, filtering, and UI real. Replace only WebGL and asset loading.
vi.mock('react-globe.gl', () => ({
    default: ({ arcsData, onArcClick, onArcHover }: {
        arcsData: (GlobeStaticArc & { isStatic: boolean })[];
        onArcClick: (arc: GlobeStaticArc) => void;
        onArcHover: (arc: GlobeStaticArc | null) => void;
    }) => {
        const arc = arcsData.find(item => item.isStatic);
        return arc && <button onClick={() => onArcClick(arc)} onMouseEnter={() => onArcHover(arc)}>Tap route</button>;
    },
}));
vi.mock('../features/flights/hooks/useGlobeTextures', () => ({
    useGlobeTextures: () => ({ isLoading: false, error: null, progress: 100 }),
}));
vi.mock('../features/flights/hooks/useGeoJsonData', () => ({
    useGeoJsonData: (file: string) => ({
        data: file === 'flights.geojson' ? flights : file === 'visitedAirports.geojson' ? airports : null,
        loading: false, error: null,
    }),
}));

function YearLinks() {
    const navigate = useNavigate();
    return <>{[2025, 2026].map(year => <button key={year} onClick={() => navigate(`?year=${year}`)}>Use {year}</button>)}</>;
}

beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
        matches: query.includes('max-width'), media: query,
        addEventListener: vi.fn(), removeEventListener: vi.fn(),
    })));
});
afterEach(() => vi.unstubAllGlobals());

describe('route previews after filtering', () => {
    it('refreshes an open touch preview and removes it when its route is excluded', () => {
        render(<MemoryRouter initialEntries={['/projects/flights/map?year=2024']}><FlightsMap /><YearLinks /></MemoryRouter>);
        fireEvent.click(screen.getByRole('button', { name: 'Tap route' }));
        expect(within(screen.getByRole('dialog', { name: 'Route information' })).getByText('2.8 h')).toBeVisible();
        fireEvent.click(screen.getByRole('button', { name: 'Use 2025' }));
        const dialog = screen.getByRole('dialog', { name: 'Route information' });
        expect(within(dialog).getByText('4 h')).toBeVisible();
        expect(dialog).toHaveTextContent('0 actual · 1 scheduled · 0 estimated');
        expect(dialog).not.toHaveTextContent('2.8 h');
        fireEvent.click(screen.getByRole('button', { name: 'Use 2026' }));
        expect(screen.queryByRole('dialog', { name: 'Route information' })).not.toBeInTheDocument();
    });

    it('refreshes hover time from the current route data', () => {
        render(<MemoryRouter initialEntries={['/projects/flights/map?year=2024']}><FlightsMap /><YearLinks /></MemoryRouter>);
        fireEvent.mouseEnter(screen.getByRole('button', { name: 'Tap route' }));
        expect(screen.getByRole('tooltip')).toHaveTextContent('Flight time: 2.8 h');
        fireEvent.click(screen.getByRole('button', { name: 'Use 2025' }));
        expect(screen.getByRole('tooltip')).toHaveTextContent('Est. flight time: 4 h');
        fireEvent.click(screen.getByRole('button', { name: 'Use 2026' }));
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
});
