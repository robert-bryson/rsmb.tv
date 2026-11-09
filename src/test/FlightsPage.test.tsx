import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Flights from '../pages/Flights';
import { clearCache } from '../data/fetchCache';
import { makeAirport, makeFlight } from './helpers/flights';

// Replace the map UI; keep page startup, metadata, and data hooks real.
vi.mock('../features/flights/components/FlightsMap', async () => {
    const { useGeoJsonData } = await import('../features/flights/hooks/useGeoJsonData');
    return {
        FlightsMap() {
            const flights = useGeoJsonData<{ count: number }>('flights.geojson');
            const airports = useGeoJsonData<{ count: number }>('visitedAirports.geojson');
            return <p role="status">
                {flights.loading || airports.loading ? 'Loading flight data' : `${flights.data?.count} flights, ${airports.data?.count} airports`}
            </p>;
        },
    };
});

afterEach(() => {
    clearCache();
    vi.unstubAllGlobals();
});

it('shares pending startup requests with the mounted map and keeps its main landmark through loading', async () => {
    const responses = new Map<string, (response: Response) => void>();
    const fetchMock = vi.fn<(url: string, options?: RequestInit) => Promise<Response>>(url => new Promise(resolve => { responses.set(url, resolve); }));
    vi.stubGlobal('fetch', fetchMock);
    const { unmount } = render(<MemoryRouter initialEntries={['/projects/flights/map']}><Flights /></MemoryRouter>);
    const main = screen.getByRole('main');
    expect(main).toHaveTextContent('Loading flight globe');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls.every(([, options]) => options?.priority === 'auto')).toBe(true);
    await screen.findByText('Loading flight data');
    expect([...responses.keys()].sort()).toEqual(['/data/flights/flights.geojson', '/data/flights/visitedAirports.geojson']);
    // Consumers have mounted while both requests are still pending.
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => {
        responses.get('/data/flights/flights.geojson')!(Response.json({ count: 12, type: 'FeatureCollection', features: [
            { type: 'Feature', properties: makeFlight(), geometry: { type: 'LineString', coordinates: [[-122.31, 47.45], [-118.41, 33.94]] } },
        ] }));
        responses.get('/data/flights/visitedAirports.geojson')!(Response.json({ count: 4, type: 'FeatureCollection', features: [
            { type: 'Feature', properties: makeAirport('SEA'), geometry: { type: 'Point', coordinates: [-122.31, 47.45] } },
        ] }));
    });
    expect(await screen.findByText('12 flights, 4 airports')).toBeVisible();
    expect(screen.getByRole('main')).toBe(main);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    unmount();
    render(<MemoryRouter initialEntries={['/projects/flights/map']}><Flights /></MemoryRouter>);
    expect(await screen.findByText('12 flights, 4 airports')).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(2);
});
