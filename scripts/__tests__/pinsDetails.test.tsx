import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parsePinDetails, pinDetailsManifestSchema, pinDetailsMatch, pinDetailsScope } from '../../shared/pinDetails';
import { PinLocationDetails } from '../../src/features/pins/PinLocationDetails';
import { compassDirection, formatElevation, pinMapLinks } from '../../src/features/pins/locationDetails';
import { PIN_DETAILS_BASE_URL, usePinDetails } from '../../src/features/pins/usePinDetails';
import { clearCache } from '../../src/data/fetchCache';
import { publishedPins } from './pinsFixtures';
import { pinContextFileFixture, pinContextFixture, pinContextManifestFixture } from '../../tests/fixtures/pinContext';

const national = publishedPins.pins.find(pin => pin.id === 'country-US')!;
const colorado = publishedPins.pins.find(pin => pin.id === 'state-08')!;
const response = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
afterEach(() => { cleanup(); clearCache(); vi.unstubAllGlobals(); });

describe('pin location context', () => {
    it('links exact coordinates to external maps and formats elevation and compass units', () => {
        const links = pinMapLinks(national);
        expect(new URL(links.google).searchParams.get('api')).toBe('1');
        expect(new URL(links.google).searchParams.get('query')).toBe('39.05186600,-97.44220300');
        expect(new URL(links.osm).searchParams.get('mlat')).toBe('39.05186600');
        expect(new URL(links.osm).hash).toBe('#map=15/39.05186600/-97.44220300');
        expect(formatElevation(390, 'mi')).toBe('1,280 ft');
        expect(formatElevation(0, 'km')).toBe('0 m');
        expect(formatElevation(-20, 'km')).toBe('-20 m');
        expect([0, 79.76, 180, 315, 359.9].map(compassDirection)).toEqual(['N', 'E', 'S', 'NW', 'N']);
    });

    it('rejects invalid inventories, duplicate IDs, wrong scopes, and stale pin coordinates', () => {
        expect(pinDetailsManifestSchema.safeParse(pinContextManifestFixture).success).toBe(true);
        expect(pinDetailsManifestSchema.safeParse({ ...pinContextManifestFixture, files: { '../countries.json': pinContextManifestFixture.files['countries.json'] } }).success).toBe(false);
        expect(pinDetailsManifestSchema.safeParse({ ...pinContextManifestFixture, coverage: { pins: 2, elevations: 1, places: 2 } }).success).toBe(false);
        expect(() => parsePinDetails({ ...pinContextFileFixture, pins: [pinContextFixture, pinContextFixture] }, 'countries.json', 2)).toThrow();
        expect(() => parsePinDetails(pinContextFileFixture, 'regions/USA.json', 1)).toThrow();
        expect(parsePinDetails({ schemaVersion: 1, scope: 'regions/CHN.json', pins: [{ ...pinContextFixture, id: 'region-PFA+00?' }] }, 'regions/CHN.json', 1).pins).toHaveLength(1);
        expect(() => parsePinDetails({ schemaVersion: 1, scope: 'regions/USA.json', pins: [{ ...pinContextFixture, id: 'region-PFA+00?' }] }, 'regions/USA.json', 1)).toThrow();
        expect(() => parsePinDetails({ ...pinContextFileFixture, pins: [{ ...pinContextFixture, elevationMeters: 0, elevationDataset: null }] }, 'countries.json', 1)).toThrow();
        expect(pinDetailsMatch(national, pinContextFixture)).toBe(true);
        expect(pinDetailsMatch({ ...national, lat: national.lat + 0.01 }, pinContextFixture)).toBe(false);
        expect(pinDetailsScope(national)).toBe('countries.json');
        expect(pinDetailsScope(colorado)).toBe('regions/USA.json');
        expect(pinDetailsScope(publishedPins.pins.find(pin => pin.id === 'county-08001')!)).toBe('counties/08.json');
    });

    it('fetches only after selection, loads one scope, and refuses data from an older pole', async () => {
        const fetcher = vi.fn(async (url: string) => response(url.endsWith('manifest-v1.json') ? pinContextManifestFixture : pinContextFileFixture));
        vi.stubGlobal('fetch', fetcher);
        const hook = renderHook(({ pin }) => usePinDetails(pin), { initialProps: { pin: null as typeof national | null } });
        expect(fetcher).not.toHaveBeenCalled();
        hook.rerender({ pin: national });
        await waitFor(() => expect(hook.result.current.data?.nearestPlace.name).toBe('Bennington'));
        expect(fetcher).toHaveBeenCalledTimes(2);
        expect(String(fetcher.mock.calls[1][0])).toBe(`${PIN_DETAILS_BASE_URL}/releases/${'a'.repeat(64)}/countries.json`);
        hook.rerender({ pin: { ...national, lat: national.lat + 0.001 } });
        expect(hook.result.current.data).toBeNull();
        expect(hook.result.current.error).toBe(true);
    });

    it('keeps map links available during a data failure and retries without changing selection', async () => {
        let fail = true;
        vi.stubGlobal('fetch', vi.fn(async (url: string) => fail ? new Response('Unavailable', { status: 503 }) : response(url.endsWith('manifest-v1.json') ? pinContextManifestFixture : pinContextFileFixture)));
        const view = render(<PinLocationDetails pin={national} unit="mi" />);
        await screen.findByRole('button', { name: 'Retry location details' });
        expect(screen.getByRole('link', { name: 'Google Maps ↗' })).toHaveAttribute('target', '_blank');
        expect(screen.getByRole('link', { name: 'OpenStreetMap ↗' })).toHaveAttribute('rel', 'noopener noreferrer');
        fail = false;
        fireEvent.click(screen.getByRole('button', { name: 'Retry location details' }));
        await screen.findByText('1,280 ft above sea level');
        expect(screen.getByText(/8.31 mi E of/)).toBeVisible();
        expect(screen.getByRole('link', { name: 'Bennington ↗' })).toHaveAttribute('href', 'https://www.geonames.org/4268150/');
        view.rerender(<PinLocationDetails pin={national} unit="km" />);
        expect(screen.getByText('390 m above sea level')).toBeVisible();
        expect(screen.getByText(/13.4 km E of/)).toBeVisible();
    });

    it('does not show a late response for the previously selected scope', async () => {
        const regional = { ...pinContextFixture, id: colorado.id, lat: colorado.lat, lng: colorado.lng };
        const manifest = { ...pinContextManifestFixture, files: { ...pinContextManifestFixture.files, 'regions/USA.json': { sha256: 'c'.repeat(64), bytes: 600, count: 1 } }, coverage: { pins: 2, elevations: 2, places: 2 } };
        let finishCountry!: (value: Response) => void;
        vi.stubGlobal('fetch', vi.fn((url: string) => url.endsWith('manifest-v1.json') ? Promise.resolve(response(manifest))
            : url.endsWith('/countries.json') ? new Promise<Response>(resolve => { finishCountry = resolve; })
                : Promise.resolve(response({ schemaVersion: 1, scope: 'regions/USA.json', pins: [regional] }))));
        const hook = renderHook(({ pin }) => usePinDetails(pin), { initialProps: { pin: national } });
        await waitFor(() => expect(finishCountry).toBeTypeOf('function'));
        hook.rerender({ pin: colorado });
        await waitFor(() => expect(hook.result.current.data?.id).toBe(colorado.id));
        await act(async () => { finishCountry(response(pinContextFileFixture)); });
        expect(hook.result.current.data?.id).toBe(colorado.id);
    });

    it('keeps external maps available when the manifest does not contain the selected scope', async () => {
        const fetcher = vi.fn(async () => response(pinContextManifestFixture));
        vi.stubGlobal('fetch', fetcher);
        render(<PinLocationDetails pin={colorado} unit="mi" />);
        await screen.findByRole('button', { name: 'Retry location details' });
        expect(screen.getByRole('link', { name: 'Google Maps ↗' })).toBeVisible();
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(screen.queryByText(/above sea level/)).toBeNull();
    });

    it('recovers a rejected scope response while keeping the selected pin', async () => {
        let invalid = true;
        vi.stubGlobal('fetch', vi.fn(async (url: string) => response(url.endsWith('manifest-v1.json')
            ? pinContextManifestFixture : invalid ? { ...pinContextFileFixture, pins: [] } : pinContextFileFixture)));
        render(<PinLocationDetails pin={national} unit="mi" />);
        await screen.findByRole('button', { name: 'Retry location details' });
        invalid = false;
        fireEvent.click(screen.getByRole('button', { name: 'Retry location details' }));
        await screen.findByText('1,280 ft above sea level');
        expect(screen.queryByRole('button', { name: 'Retry location details' })).toBeNull();
    });

    it('shows missing terrain and a coincident place without inventing an elevation or direction', async () => {
        const details = { ...pinContextFixture, elevationMeters: null, elevationDataset: null,
            nearestPlace: { ...pinContextFixture.nearestPlace, distanceMeters: 0, admin1Name: '' } };
        vi.stubGlobal('fetch', vi.fn(async (url: string) => response(url.endsWith('manifest-v1.json')
            ? { ...pinContextManifestFixture, coverage: { pins: 1, elevations: 0, places: 1 } }
            : { ...pinContextFileFixture, pins: [details] })));
        render(<PinLocationDetails pin={national} unit="km" />);
        await screen.findByText('No terrain sample available');
        expect(screen.getByText(/0 km from/)).toBeVisible();
        expect(screen.getByText('United States · straight-line distance')).toBeVisible();
        expect(screen.queryByText(/Approximate terrain/)).toBeNull();
    });

    it('attributes fallback terrain to ASTER', async () => {
        vi.stubGlobal('fetch', vi.fn(async (url: string) => response(url.endsWith('manifest-v1.json')
            ? pinContextManifestFixture
            : { ...pinContextFileFixture, pins: [{ ...pinContextFixture, elevationDataset: 'aster30m' }] })));
        render(<PinLocationDetails pin={national} unit="km" />);
        await screen.findByText('390 m above sea level');
        expect(screen.getByRole('link', { name: 'NASA/METI ASTER' })).toHaveAttribute('href', 'https://www.opentopodata.org/datasets/aster/');
    });
});
