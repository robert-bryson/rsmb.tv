import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { useFlightsFilters } from '../features/flights/hooks/useFlightsFilters';

function wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={['/map']}>{children}</MemoryRouter>;
}

describe('flight filter transitions', () => {
    it('applies an existing layer callback to current URL state after a commit', () => {
        const { result } = renderHook(useFlightsFilters, { wrapper });
        const toggleAirports = () => result.current.setAllAirportsVisible(visible => !visible);
        const initialSetter = result.current.setAllAirportsVisible;
        act(toggleAirports);
        expect(result.current.allAirportsVisible).toBe(true);
        act(() => initialSetter(visible => !visible));
        expect(result.current.allAirportsVisible).toBe(false);
    });

    it('retains newer filters when an earlier event callback changes a different setting', () => {
        const { result } = renderHook(useFlightsFilters, { wrapper });
        const setStates = result.current.setUSStatesVisible;
        act(() => result.current.setSelectedYear(2024));
        act(() => setStates(true));
        expect(result.current.usStatesVisible).toBe(true);
        expect(result.current.selectedYear).toBe(2024);
    });

    it('uses an external navigation as the base for an existing callback', () => {
        const { result } = renderHook(() => ({ ...useFlightsFilters(), navigate: useNavigate() }), { wrapper });
        const setStates = result.current.setUSStatesVisible;
        act(() => result.current.navigate('/map?year=2025&airline=Other'));
        act(() => setStates(true));
        expect(result.current.usStatesVisible).toBe(true);
        expect(result.current.selectedYear).toBe(2025);
        expect(result.current.selectedAirline).toBe('Other');
    });

    it('does not add a history entry when an interaction writes the current rotation state', () => {
        const { result } = renderHook(() => ({ ...useFlightsFilters(), navigate: useNavigate(), location: useLocation() }), {
            wrapper: ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={['/previous', '/map']}>{children}</MemoryRouter>,
        });
        act(() => result.current.setGlobeRotationEnabled(false));
        act(() => result.current.navigate(-1));
        expect(result.current.location.pathname).toBe('/previous');
    });
});
