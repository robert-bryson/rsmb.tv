import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PinsExplorer from '../../src/features/pins/PinsExplorer';
import { usePinsData, useWorldPinsData } from '../../src/features/pins/data';
import { usePinDetails } from '../../src/features/pins/usePinDetails';
import type { PinsMapProps } from '../../src/features/pins/types';
import { publishedPins } from './pinsFixtures';
import { readPinsArtifact } from './pinsFixtures';
import { parseWorldBoundaries, parseWorldCountries, parseWorldRegionPins, worldPinsDataSchema } from '../../shared/worldPins';

vi.mock('../../src/features/pins/data', () => ({ usePinsData: vi.fn(), useWorldPinsData: vi.fn() }));
vi.mock('../../src/features/pins/usePinDetails', () => ({ usePinDetails: vi.fn() }));
vi.mock('../../src/features/pins/PinsMap', () => ({ PinsMap: (props: PinsMapProps) => <div>
    <button onClick={() => props.onSelect('country-US')}>Select national pin on map</button>
    <button onClick={() => props.onSelect('state-08')}>Select Colorado on map</button>
    <button onClick={() => props.onSelect('county-51610')}>Select Falls Church on map</button>
    <button onClick={() => props.onNavigateUp?.()}>Click empty map</button>
    <button onClick={() => props.onSelect('unknown')}>Select unknown map feature</button>
    <button onClick={() => props.onZoom(4)}>Set county zoom</button>
    <button onClick={() => props.onZoom(6)}>Set county boundary zoom</button>
    <output aria-label="Map view bounds">{props.view?.bounds.join(',')}</output>
    <output aria-label="Map view request">{props.view?.key}</output>
    <output aria-label="Map resource state">{props.dataState}</output>
    <output aria-label="Map boundary IDs">{props.states?.features.map(feature => feature.id).join(',')}</output>
</div> }));
vi.mock('../../src/components/IntentLink', () => ({ IntentLink: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => <a href={to} {...props}>{children}</a> }));

const resource = <T,>(data: T | null, error: string | null = null, loading = false) => ({ data, error, loading, retry: vi.fn() });
function resources() { return { pins: resource(publishedPins), states: resource(null), counties: resource(null) }; }
function Location() {
    const { search } = useLocation(), navigate = useNavigate();
    return <><output aria-label="Current query">{search}</output><button onClick={() => navigate(-1)}>Map history back</button><button onClick={() => navigate(1)}>Map history forward</button></>;
}
function open(query = '') {
    return render(<MemoryRouter initialEntries={[`/projects/pins-of-inaccessibility/map${query}`]}><PinsExplorer /><Location /></MemoryRouter>);
}
const results = () => document.querySelector('.pins-results') as HTMLElement;
const rows = () => within(results()).queryAllByRole('listitem');
const worldCountries = worldPinsDataSchema.parse(readPinsArtifact('world/pins.json'));
const worldOutlines = parseWorldCountries(readPinsArtifact('world/countries.geojson'));
const canada = parseWorldRegionPins(readPinsArtifact('world/regions/CAN.json'), 'CAN');

beforeEach(() => {
    vi.mocked(usePinDetails).mockReturnValue({ data: null, loading: false, error: true, retry: vi.fn() });
    vi.mocked(usePinsData).mockReturnValue(resources());
    vi.mocked(useWorldPinsData).mockReturnValue({ pins: resource(null), countries: resource(null), regions: resource(null), outlines: resource(null) });
    localStorage.clear();
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
    HTMLElement.prototype.scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollTo = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('pin explorer behavior', () => {
    it('opens a county with its state scope and recenters a repeated selection without duplicating history', () => {
        open('?state=08&keep=1');
        fireEvent.click(screen.getByRole('button', { name: 'Map layers', exact: true }));
        fireEvent.click(screen.getByRole('button', { name: 'Off', exact: true }));
        fireEvent.click(screen.getByRole('button', { name: 'Select Falls Church on map' }));
        expect(screen.getByLabelText('Within')).toHaveValue('51');
        expect(screen.getByRole('button', { name: 'Counties', exact: true })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'Auto', exact: true })).toHaveAttribute('aria-pressed', 'true');
        const camera = screen.getByLabelText('Map view request').textContent;
        const query = screen.getByLabelText('Current query').textContent;
        fireEvent.click(screen.getByRole('button', { name: 'Select Falls Church on map' }));
        expect(screen.getByLabelText('Current query').textContent).toBe(query);
        expect(screen.getByLabelText('Map view request').textContent).not.toBe(camera);
        fireEvent.click(screen.getByRole('button', { name: 'Map history back' }));
        expect(screen.getByLabelText('Within')).toHaveValue('08');
        expect(screen.queryByRole('region', { name: 'Selected pin' })).toBeNull();
    });

    it('lets the location trail skip to an ancestor and the parent control return to the world', () => {
        open('?pin=county-51610&keep=1');
        const trail = screen.getByRole('navigation', { name: 'Map location' });
        fireEvent.click(within(trail).getByRole('button', { name: 'United States', exact: true }));
        expect(screen.getByLabelText('Within')).toHaveValue('');
        expect(screen.queryByRole('region', { name: 'Selected pin' })).toBeNull();
        expect(screen.getByLabelText('Current query')).toHaveTextContent('?keep=1');
        fireEvent.click(screen.getByRole('button', { name: 'Up one level: world overview', exact: true }));
        expect(screen.getByLabelText('Country / territory')).toHaveValue('ALL');
        expect(within(trail).getByRole('button', { name: 'World overview' })).toHaveFocus();
    });

    it('uses the jump control for countries and provinces and lets their ranking tabs switch levels', () => {
        vi.mocked(useWorldPinsData).mockImplementation(code => ({
            pins: resource(worldCountries), countries: resource(worldOutlines), regions: resource(code === 'CAN' ? canada : null), outlines: resource(null),
        }));
        open('?country=ALL&keep=1');
        fireEvent.change(screen.getByLabelText('Jump to region'), { target: { value: 'CAN' } });
        expect(rows()).toHaveLength(13);
        fireEvent.click(screen.getByRole('button', { name: 'Countries & territories', exact: true }));
        expect(rows()).toHaveLength(1);
        fireEvent.click(screen.getByRole('button', { name: 'States & provinces', exact: true }));
        expect(rows()).toHaveLength(13);
        fireEvent.change(screen.getByLabelText('Jump to region'), { target: { value: 'region-CAN-682' } });
        expect(screen.getByRole('region', { name: 'Selected pin' })).toHaveTextContent('Ontario');
        expect(screen.getByLabelText('Current query')).toHaveTextContent('keep=1&country=CAN&pin=region-CAN-682');
        fireEvent.change(screen.getByLabelText('Jump to region'), { target: { value: 'overview' } });
        expect(screen.queryByRole('region', { name: 'Selected pin' })).toBeNull();
        expect(screen.getByLabelText('Country / territory')).toHaveValue('CAN');
        expect(rows()).toHaveLength(13);
    });

    it('normalizes conflicting shared country parameters before navigating to a parent', () => {
        vi.mocked(useWorldPinsData).mockReturnValue({ pins: resource(worldCountries), countries: resource(worldOutlines), regions: resource(null), outlines: resource(null) });
        open('?country=CAN&pin=country-US&keep=1');
        expect(screen.getByLabelText('Country / territory')).toHaveValue('USA');
        expect(screen.getByLabelText('Current query')).toHaveTextContent('?keep=1&pin=country-US');
        fireEvent.click(screen.getByRole('button', { name: 'Up one level: world overview', exact: true }));
        fireEvent.click(screen.getByRole('button', { name: 'Map history back' }));
        expect(screen.getByLabelText('Country / territory')).toHaveValue('USA');
        expect(screen.getByRole('region', { name: 'Selected pin' })).toHaveTextContent('United States');
    });

    it('recenters an unchanged overview only when requested and keeps layer disclosure independent of location', () => {
        open('?keep=1');
        const view = screen.getByLabelText('Map view request');
        const original = view.textContent;
        fireEvent.click(screen.getByRole('button', { name: 'Set county zoom' }));
        expect(view.textContent).toBe(original);
        fireEvent.click(screen.getByRole('button', { name: 'United States', exact: true }));
        expect(view.textContent).not.toBe(original);
        const reset = view.textContent;
        const disclosure = screen.getByRole('button', { name: 'Map layers', exact: true });
        fireEvent.click(disclosure);
        fireEvent.click(disclosure);
        expect(disclosure).toHaveAttribute('aria-expanded', 'false');
        expect(view.textContent).toBe(reset);
        expect(screen.getByLabelText('Current query')).toHaveTextContent('?keep=1');
        fireEvent.click(screen.getByRole('button', { name: 'World overview', exact: true }));
        const world = view.textContent;
        fireEvent.click(screen.getByRole('button', { name: 'World overview', exact: true }));
        expect(view.textContent).not.toBe(world);
    });

    it('discloses all map information on request and closes settings before geographic navigation', () => {
        open('?pin=county-51610&keep=1');
        const layers = screen.getByRole('button', { name: 'Map layers', exact: true });
        expect(layers).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('checkbox', { name: 'All radius circles' })).toBeNull();
        fireEvent.click(layers);
        expect(screen.getByRole('group', { name: 'Map symbols' })).toHaveTextContent('Other pins · selectable');
        expect(screen.getByText(/Click outside the selection or press Esc/)).toBeVisible();
        fireEvent.keyDown(screen.getByRole('checkbox', { name: 'All radius circles' }), { key: 'Escape' });
        expect(layers).toHaveAttribute('aria-expanded', 'false');
        expect(layers).toHaveFocus();
        expect(screen.getByRole('region', { name: 'Selected pin' })).toHaveTextContent('Falls Church city');
        const before = screen.getByLabelText('Map view request').textContent;
        fireEvent.click(screen.getByRole('button', { name: 'Falls Church city', exact: true }));
        expect(screen.getByLabelText('Map view request').textContent).not.toBe(before);
        expect(screen.getByLabelText('Current query')).toHaveTextContent('pin=county-51610');
        fireEvent.click(layers);
        fireEvent.pointerDown(screen.getByRole('button', { name: 'World overview', exact: true }));
        expect(layers).toHaveAttribute('aria-expanded', 'false');
        expect(screen.getByRole('region', { name: 'Selected pin' })).toBeVisible();
    });

    it('keeps failed optional country context from blocking the U.S. map and makes it retryable in world view', () => {
        const world = { pins: resource(null, 'failed'), countries: resource(worldOutlines), regions: resource(null), outlines: resource(null) };
        vi.mocked(useWorldPinsData).mockReturnValue(world);
        open();
        expect(screen.getByLabelText('Map resource state')).toHaveTextContent('ready');
        expect(screen.queryByRole('button', { name: 'Retry pin data' })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'World overview', exact: true }));
        expect(screen.getByLabelText('Map resource state')).toHaveTextContent('error');
        fireEvent.click(screen.getByRole('button', { name: 'Retry pin data' }));
        expect(world.pins.retry).toHaveBeenCalledOnce();
    });

    it('clears a search before navigating up and lets native selectors handle Escape', () => {
        open('?pin=state-08');
        const search = screen.getByRole('searchbox');
        fireEvent.change(search, { target: { value: 'Colorado' } });
        fireEvent.keyDown(search, { key: 'Escape' });
        expect(search).toHaveValue('');
        expect(screen.getByRole('region', { name: 'Selected pin' })).toHaveTextContent('Colorado');
        fireEvent.keyDown(screen.getByLabelText('Country / territory'), { key: 'Escape' });
        expect(screen.getByRole('region', { name: 'Selected pin' })).toHaveTextContent('Colorado');
        fireEvent.keyDown(document, { key: 'Escape', repeat: true });
        expect(screen.getByRole('region', { name: 'Selected pin' })).toHaveTextContent('Colorado');
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('region', { name: 'Selected pin' })).toBeNull();
        expect(screen.getByLabelText('Country / territory')).toHaveValue('USA');
    });
    it('moves from a county through state and country views to the world on empty-map clicks', () => {
        open('?pin=county-51610&keep=1');
        const location = screen.getByRole('navigation', { name: 'Map location' });
        expect(location).toHaveTextContent('WorldUnited StatesVirginiaFalls Church city');
        fireEvent.click(screen.getByRole('button', { name: 'Click empty map' }));
        expect(screen.getByLabelText('Within')).toHaveValue('51');
        expect(screen.queryByRole('region', { name: 'Selected pin' })).toBeNull();
        expect(location.querySelector('[aria-current="location"]')).toHaveTextContent('Virginia');
        expect(screen.getByLabelText('Current query')).toHaveTextContent('state=51');
        fireEvent.click(screen.getByRole('button', { name: 'Click empty map' }));
        expect(screen.getByLabelText('Within')).toHaveValue('');
        expect(location.querySelector('[aria-current="location"]')).toHaveTextContent('United States');
        fireEvent.click(screen.getByRole('button', { name: 'Click empty map' }));
        expect(screen.getByLabelText('Country / territory')).toHaveValue('ALL');
        expect(location.querySelector('[aria-current="location"]')).toHaveTextContent('World');
        expect(screen.getByLabelText('Current query')).toHaveTextContent('keep=1&country=ALL');
        expect(screen.queryByRole('button', { name: /Up one level:/ })).toBeNull();
    });

    it('keeps foreign parent navigation and browser history in sync', () => {
        vi.mocked(useWorldPinsData).mockImplementation(code => ({
            pins: resource(worldCountries), countries: resource(worldOutlines), regions: resource(code === 'CAN' ? canada : null), outlines: resource(null),
        }));
        open('?country=CAN&pin=region-CAN-682&keep=1');
        fireEvent.click(screen.getByRole('button', { name: 'Click empty map' }));
        expect(screen.getByLabelText('Country / territory')).toHaveValue('CAN');
        expect(screen.queryByRole('region', { name: 'Selected pin' })).toBeNull();
        expect(screen.getByRole('navigation', { name: 'Map location' }).querySelector('[aria-current]')).toHaveTextContent('Canada');
        fireEvent.click(screen.getByRole('button', { name: 'Click empty map' }));
        expect(screen.getByLabelText('Country / territory')).toHaveValue('ALL');
        fireEvent.click(screen.getByRole('button', { name: 'Map history back' }));
        expect(screen.getByLabelText('Country / territory')).toHaveValue('CAN');
        fireEvent.click(screen.getByRole('button', { name: 'Map history back' }));
        expect(screen.getByRole('region', { name: 'Selected pin' })).toHaveTextContent('Ontario');
        fireEvent.click(screen.getByRole('button', { name: 'Map history forward' }));
        expect(screen.queryByRole('region', { name: 'Selected pin' })).toBeNull();
        expect(screen.getByLabelText('Current query')).toHaveTextContent('keep=1');
    });

    it('uses province coastlines without overlaying a conflicting country overview', () => {
        const tobago = parseWorldRegionPins(readPinsArtifact('world/regions/TTO.json'), 'TTO');
        const outlines = parseWorldBoundaries(readPinsArtifact('world/regions/TTO.geojson'), 'TTO');
        vi.mocked(useWorldPinsData).mockReturnValue({
            pins: resource(worldCountries), countries: resource(worldOutlines), regions: resource(tobago), outlines: resource(outlines),
        });
        open('?country=TTO');
        fireEvent.click(screen.getByRole('button', { name: 'Map layers', exact: true }));
        const boundaries = screen.getByLabelText('Map boundary IDs');
        expect(boundaries).toHaveTextContent('region-TTO-5090');
        expect(boundaries).not.toHaveTextContent('country-TTO');
        fireEvent.click(screen.getByRole('checkbox', { name: 'States & provinces', exact: true }));
        expect(boundaries).toHaveTextContent(/^country-TTO$/);
        fireEvent.click(screen.getByRole('checkbox', { name: 'States & provinces', exact: true }));
        expect(boundaries).not.toHaveTextContent('country-TTO');
        expect(boundaries).toHaveTextContent('region-TTO-5090');
    });

    it('switches from world countries to real Canadian provinces and preserves URL context', () => {
        vi.mocked(useWorldPinsData).mockImplementation(code => ({
            pins: resource(worldCountries), countries: resource(worldOutlines),
            regions: resource(code === 'CAN' ? canada : null), outlines: resource(null),
        }));
        open('?keep=1');
        fireEvent.change(screen.getByLabelText('Country / territory'), { target: { value: 'ALL' } });
        expect(screen.getByText('257 pins ranked by radius')).toBeVisible();
        expect(usePinsData).toHaveBeenLastCalledWith(false, false);
        fireEvent.change(screen.getByLabelText('Country / territory'), { target: { value: 'CAN' } });
        expect(rows()).toHaveLength(13);
        expect(screen.getByRole('region', { name: 'Canada pole' })).toBeVisible();
        fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'CA-ON' } });
        expect(rows()).toHaveLength(1);
        fireEvent.click(within(results()).getByRole('button'));
        expect(screen.getByRole('region', { name: 'Selected pin' })).toHaveTextContent('Ontario, Canada');
        expect(screen.getByRole('region', { name: 'Selected pin' })).toHaveTextContent('Mapped area');
        expect(screen.getByLabelText('Current query')).toHaveTextContent('keep=1');
        expect(screen.getByLabelText('Current query')).toHaveTextContent('pin=region-CAN-682');
        fireEvent.change(screen.getByLabelText('Country / territory'), { target: { value: 'USA' } });
        expect(screen.getByLabelText('Current query')).toHaveTextContent('?keep=1');
        expect(screen.getByRole('region', { name: 'U.S. pole' })).toBeVisible();
        fireEvent.change(screen.getByLabelText('Country / territory'), { target: { value: 'BJN' } });
        expect(screen.getByText(/This source has no regional divisions/)).toBeVisible();
        fireEvent.change(screen.getByLabelText('Country / territory'), { target: { value: 'VAT' } });
        fireEvent.click(within(screen.getByRole('region', { name: 'Vatican City pole' })).getByRole('button'));
        expect(screen.getByRole('region', { name: 'Selected pin' })).toHaveTextContent('especially approximate');
    });

    it('restores a province-only shared link and rejects unknown country paths', () => {
        vi.mocked(useWorldPinsData).mockReturnValue({ pins: resource(worldCountries), countries: resource(worldOutlines), regions: resource(canada), outlines: resource(null) });
        const view = open('?pin=region-CAN-682');
        expect(screen.getByLabelText('Country / territory')).toHaveValue('CAN');
        expect(screen.getByRole('region', { name: 'Selected pin' })).toHaveTextContent('Ontario');
        view.unmount();
        open('?country=../../private');
        expect(screen.getByLabelText('Country / territory')).toHaveValue('USA');
        expect(useWorldPinsData).toHaveBeenLastCalledWith('USA', true);
    });

    it('keeps a failed hidden province outline from blocking country pins and retries on demand', () => {
        const retry = vi.fn();
        vi.mocked(useWorldPinsData).mockImplementation((_code, visible = true) => ({
            pins: resource(worldCountries), countries: resource(worldOutlines), regions: resource(canada),
            outlines: { ...resource(null, visible ? 'failed' : null), retry },
        }));
        open('?country=CAN');
        expect(screen.getByLabelText('Map resource state')).toHaveTextContent('error');
        fireEvent.click(screen.getByRole('button', { name: 'Map layers', exact: true }));
        fireEvent.click(screen.getByRole('checkbox', { name: 'States & provinces', exact: true }));
        expect(useWorldPinsData).toHaveBeenLastCalledWith('CAN', false);
        expect(screen.getByLabelText('Map resource state')).toHaveTextContent('ready');
        expect(screen.queryByRole('button', { name: 'Retry boundaries' })).not.toBeInTheDocument();
        expect(rows()).toHaveLength(13);
        fireEvent.click(screen.getByRole('checkbox', { name: 'States & provinces', exact: true }));
        fireEvent.click(screen.getByRole('button', { name: 'Retry boundaries' }));
        expect(retry).toHaveBeenCalledOnce();
    });
    it('paginates rankings, filters by scope and search, and changes sort order', () => {
        open();
        expect(rows()).toHaveLength(30);
        expect(rows()[0]).toHaveTextContent('Alaska');
        fireEvent.click(screen.getByRole('button', { name: /Show 26 more/ })); expect(rows()).toHaveLength(56);
        fireEvent.change(screen.getByLabelText('Sort pins'), { target: { value: 'smallest' } });
        expect(rows()).toHaveLength(30); expect(rows()[0]).toHaveTextContent('District of Columbia');
        fireEvent.change(screen.getByLabelText('Sort pins'), { target: { value: 'name' } });
        expect(rows()[0]).toHaveTextContent('Alabama');
        expect(screen.getByText('56 pins sorted by name')).toBeVisible();
        fireEvent.click(screen.getByRole('button', { name: 'Counties', exact: true }));
        fireEvent.change(screen.getByLabelText('Within'), { target: { value: '66' } });
        expect(rows()).toHaveLength(1); expect(rows()[0]).toHaveTextContent('Guam');
        fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'no such place' } });
        expect(rows()).toHaveLength(0); expect(screen.getByText(/No pins match/)).toBeVisible();
        fireEvent.change(screen.getByLabelText('Within'), { target: { value: '08' } });
        expect(screen.getByRole('searchbox')).toHaveValue('');
        expect(rows()).toHaveLength(30);
        fireEvent.change(screen.getByRole('searchbox'), { target: { value: '08123' } });
        expect(rows()[0]).toHaveTextContent('Weld County');
    });

    it('restores a shared county, clears selection, and reveals pins outside a scope', () => {
        open('?pin=county-51610&keep=value');
        expect(screen.getByRole('region', { name: 'Selected pin' })).toHaveTextContent('Falls Church city');
        expect(screen.getByRole('button', { name: 'Counties', exact: true })).toHaveAttribute('aria-pressed', 'true');
        const initialView = screen.getByLabelText('Map view bounds').textContent;
        fireEvent.click(screen.getByRole('button', { name: 'Zoom to pin ↗' }));
        expect(screen.getByLabelText('Map view bounds')).toHaveTextContent(initialView!);
        fireEvent.click(screen.getByRole('button', { name: 'Back to Virginia, close selection' }));
        expect(screen.getByLabelText('Current query')).toHaveTextContent('?keep=value&state=51');
        expect(screen.queryByRole('region', { name: 'Selected pin' })).not.toBeInTheDocument();
        expect(screen.getByLabelText('Map view bounds')).toHaveTextContent(publishedPins.pins.find(pin => pin.id === 'state-51')!.bounds.join(','));
        expect(screen.getByRole('button', { name: 'Up one level: United States', exact: true })).toHaveFocus();
        fireEvent.change(screen.getByLabelText('Country / territory'), { target: { value: 'USA' } });
        fireEvent.change(screen.getByLabelText('Within'), { target: { value: '66' } });
        fireEvent.click(screen.getByRole('button', { name: 'Select national pin on map' }));
        expect(screen.getByLabelText('Within')).toHaveValue('');
        expect(screen.getByRole('region', { name: 'Selected pin' })).toHaveTextContent('United States');
        expect(screen.getByLabelText('Current query')).toHaveTextContent('pin=country-US');
        fireEvent.click(screen.getByRole('button', { name: 'Select unknown map feature' }));
        expect(screen.getByLabelText('Current query')).toHaveTextContent('pin=country-US');
    });

    it('moves up one geographic level with Escape and lets the world breadcrumb return home', () => {
        open('?pin=state-08&keep=1');
        fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Colorado' } });
        fireEvent.keyDown(screen.getByRole('region', { name: 'Selected pin' }), { key: 'Escape' });
        expect(screen.getByRole('searchbox')).toHaveValue('');
        expect(screen.getByLabelText('Country / territory')).toHaveValue('USA');
        expect(screen.getByLabelText('Within')).toHaveValue('');
        expect(screen.getByLabelText('Current query')).toHaveTextContent('keep=1');
        expect(screen.getByLabelText('Current query')).not.toHaveTextContent('pin=');
        expect(screen.getByRole('button', { name: 'Up one level: world overview', exact: true })).toHaveFocus();
        const globe = screen.getByRole('button', { name: 'World overview', exact: true });
        fireEvent.click(globe);
        expect(screen.getByLabelText('Country / territory')).toHaveValue('ALL');
        expect(globe).toHaveFocus();
        expect(screen.getByLabelText('Map view bounds')).toHaveTextContent('-180,-60,180,83');
        fireEvent.change(screen.getByLabelText('Country / territory'), { target: { value: 'CAN' } });
        fireEvent.click(screen.getByRole('button', { name: 'World overview', exact: true }));
        expect(screen.getByLabelText('Country / territory')).toHaveValue('ALL');
    });

    it('updates unit preferences and county visibility and zooms to region shortcuts', () => {
        open();
        fireEvent.click(screen.getByRole('button', { name: 'Map layers', exact: true }));
        fireEvent.click(screen.getByRole('button', { name: 'Off', exact: true }));
        expect(screen.getByText('County pins hidden')).toBeVisible();
        fireEvent.click(screen.getByRole('button', { name: 'Counties', exact: true }));
        expect(screen.getByRole('button', { name: 'Auto', exact: true })).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(screen.getByRole('button', { name: 'Set county zoom' }));
        expect(screen.getByText('County pins visible')).toBeVisible();
        expect(usePinsData).toHaveBeenLastCalledWith(false, true);
        fireEvent.click(screen.getByRole('button', { name: 'Set county boundary zoom' }));
        expect(usePinsData).toHaveBeenLastCalledWith(true, true);
        fireEvent.click(screen.getByRole('button', { name: 'On', exact: true }));
        expect(screen.getByText('County pins always visible')).toBeVisible();
        fireEvent.click(screen.getByRole('checkbox', { name: 'All radius circles' }));
        expect(localStorage.getItem('pins-radius-circles')).toBe('false');
        fireEvent.click(within(screen.getByRole('group', { name: 'Distance units' })).getByRole('button', { name: 'km' }));
        expect(screen.getByRole('region', { name: 'U.S. pole' })).toHaveTextContent('1,091.5 km');
        expect(localStorage.getItem('pins-distance-unit')).toBe('"km"');
        fireEvent.change(screen.getByLabelText('Jump to region'), { target: { value: '66' } });
        const guamView = screen.getByLabelText('Map view bounds').textContent;
        fireEvent.click(screen.getByRole('button', { name: 'United States', exact: true }));
        expect(screen.getByLabelText('Map view bounds')).toHaveTextContent('-125,24,-66,50');
        expect(guamView).not.toBe('-125,24,-66,50');
        fireEvent.change(screen.getByLabelText('Jump to region'), { target: { value: 'country-US' } });
        expect(screen.getByRole('region', { name: 'Selected pin' })).toHaveTextContent('United States');
    });

    it('shows resource errors, calls the correct retry, and keeps mobile focus usable', () => {
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
        const data = resources(); data.pins.error = 'failed'; data.states.error = 'failed';
        vi.mocked(usePinsData).mockReturnValue(data);
        const view = open('?pin=unknown');
        const toggle = screen.getByRole('button', { name: 'Explore pins' });
        fireEvent.click(toggle);
        const panel = screen.getByRole('complementary', { name: 'Pin explorer' });
        fireEvent.click(screen.getByRole('button', { name: 'Retry pin data' })); expect(data.pins.retry).toHaveBeenCalledOnce();
        fireEvent.click(screen.getByRole('button', { name: 'Retry boundaries' })); expect(data.states.retry).toHaveBeenCalledOnce();
        fireEvent.keyDown(panel, { key: 'Escape' });
        fireEvent.keyDown(panel, { key: 'Escape' }); expect(toggle).toHaveFocus();
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        data.states.error = null; data.counties.error = 'failed'; data.pins.loading = true;
        fireEvent.change(screen.getByLabelText('Country / territory'), { target: { value: 'USA' } });
        view.rerender(<MemoryRouter><PinsExplorer /><Location /></MemoryRouter>);
        fireEvent.click(toggle);
        expect(screen.getByText('Calculations complete. Loading the pins…')).toBeVisible();
        fireEvent.click(screen.getByRole('button', { name: 'Retry boundaries' })); expect(data.counties.retry).toHaveBeenCalledOnce();
    });
});
