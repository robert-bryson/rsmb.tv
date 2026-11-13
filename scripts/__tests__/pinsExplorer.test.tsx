import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PinsExplorer from '../../src/features/pins/PinsExplorer';
import { usePinsData } from '../../src/features/pins/data';
import type { PinsMapProps } from '../../src/features/pins/types';
import { publishedPins } from './pinsFixtures';

vi.mock('../../src/features/pins/data', () => ({ usePinsData: vi.fn() }));
vi.mock('../../src/features/pins/PinsMap', () => ({ PinsMap: (props: PinsMapProps) => <div>
    <button onClick={() => props.onSelect('country-US')}>Select national pin on map</button>
    <button onClick={() => props.onSelect('unknown')}>Select unknown map feature</button>
    <button onClick={() => props.onZoom(6)}>Set county zoom</button>
    <output aria-label="Map view bounds">{props.view?.bounds.join(',')}</output>
</div> }));
vi.mock('../../src/components/IntentLink', () => ({ IntentLink: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => <a href={to} {...props}>{children}</a> }));

const resource = <T,>(data: T | null, error: string | null = null, loading = false) => ({ data, error, loading, retry: vi.fn() });
function resources() { return { pins: resource(publishedPins), states: resource(null), counties: resource(null) }; }
function Location() { const { search } = useLocation(); return <output aria-label="Current query">{search}</output>; }
function open(query = '') {
    return render(<MemoryRouter initialEntries={[`/projects/pins-of-inaccessibility/map${query}`]}><PinsExplorer /><Location /></MemoryRouter>);
}
const results = () => document.querySelector('.pins-results') as HTMLElement;
const rows = () => within(results()).queryAllByRole('listitem');

beforeEach(() => {
    vi.mocked(usePinsData).mockReturnValue(resources());
    localStorage.clear();
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
    HTMLElement.prototype.scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollTo = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('pin explorer behavior', () => {
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
        fireEvent.click(screen.getByRole('button', { name: 'Clear selected pin' }));
        expect(screen.getByLabelText('Current query')).toHaveTextContent('?keep=value');
        expect(screen.queryByRole('region', { name: 'Selected pin' })).not.toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Within'), { target: { value: '66' } });
        fireEvent.click(screen.getByRole('button', { name: 'Select national pin on map' }));
        expect(screen.getByLabelText('Within')).toHaveValue('');
        expect(screen.getByRole('region', { name: 'Selected pin' })).toHaveTextContent('United States');
        expect(screen.getByLabelText('Current query')).toHaveTextContent('pin=country-US');
        fireEvent.click(screen.getByRole('button', { name: 'Select unknown map feature' }));
        expect(screen.getByLabelText('Current query')).toHaveTextContent('pin=country-US');
    });

    it('updates unit preferences and county visibility and zooms to region shortcuts', () => {
        open();
        fireEvent.click(screen.getByRole('button', { name: 'Off', exact: true }));
        expect(screen.getByText('County pins hidden')).toBeVisible();
        fireEvent.click(screen.getByRole('button', { name: 'Counties', exact: true }));
        expect(screen.getByRole('button', { name: 'Auto', exact: true })).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(screen.getByRole('button', { name: 'Set county zoom' }));
        expect(screen.getByText('County pins visible')).toBeVisible();
        expect(usePinsData).toHaveBeenLastCalledWith(true);
        fireEvent.click(screen.getByRole('button', { name: 'On', exact: true }));
        expect(screen.getByText('County pins always visible')).toBeVisible();
        fireEvent.click(screen.getByRole('checkbox', { name: 'All radius circles' }));
        expect(localStorage.getItem('pins-radius-circles')).toBe('false');
        fireEvent.click(within(screen.getByRole('group', { name: 'Distance units' })).getByRole('button', { name: 'km' }));
        expect(screen.getByRole('region', { name: 'U.S. pole' })).toHaveTextContent('1,091.5 km');
        expect(localStorage.getItem('pins-distance-unit')).toBe('"km"');
        fireEvent.change(screen.getByLabelText('Jump to region'), { target: { value: '66' } });
        const guamView = screen.getByLabelText('Map view bounds').textContent;
        fireEvent.click(screen.getByRole('button', { name: 'U.S. overview' }));
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
        fireEvent.keyDown(panel, { key: 'Escape' }); expect(toggle).toHaveFocus();
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        data.states.error = null; data.counties.error = 'failed'; data.pins.loading = true;
        view.rerender(<MemoryRouter><PinsExplorer /><Location /></MemoryRouter>);
        fireEvent.click(toggle);
        expect(screen.getByText('Calculations complete. Loading the pins…')).toBeVisible();
        fireEvent.click(screen.getByRole('button', { name: 'Retry boundaries' })); expect(data.counties.retry).toHaveBeenCalledOnce();
    });
});
