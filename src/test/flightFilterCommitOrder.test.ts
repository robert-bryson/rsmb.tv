import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFlightsFilters } from '../features/flights/hooks/useFlightsFilters';

const navigation = vi.hoisted(() => ({
    params: new URLSearchParams(),
    type: 'PUSH',
    location: { key: 'initial', state: null as unknown },
    write: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
    useSearchParams: () => [navigation.params, navigation.write],
    useNavigationType: () => navigation.type,
    useLocation: () => navigation.location,
}));

beforeEach(() => {
    navigation.params = new URLSearchParams();
    navigation.type = 'PUSH';
    navigation.location = { key: 'initial', state: null };
    navigation.write.mockClear();
});

describe('flight filter commit ordering', () => {
    it('keeps a newer pending layer toggle when an earlier query change commits', () => {
        const { result, rerender } = renderHook(useFlightsFilters);
        act(() => result.current.setColorMode('year'));
        act(() => result.current.setAllAirportsVisible(visible => !visible));
        expect(navigation.write.mock.lastCall?.[0].toString()).toBe('color=year&allAirports=1');

        // The browser URL already contains the layer write, but React first
        // commits the earlier color navigation during concurrent rendering.
        navigation.params = new URLSearchParams('color=year');
        navigation.location = { key: 'first-write', state: navigation.write.mock.calls[0][1]?.state };
        rerender();
        act(() => result.current.setAllAirportsVisible(visible => !visible));
        expect(navigation.write.mock.lastCall?.[0].toString()).toBe('color=year');
    });

    it('discards pending writes when browser history returns to an earlier issued query', () => {
        const { result, rerender } = renderHook(useFlightsFilters);
        act(() => result.current.setColorMode('year'));
        act(() => result.current.setAllAirportsVisible(true));

        navigation.params = new URLSearchParams('color=year');
        navigation.type = 'POP';
        navigation.location = { key: 'back', state: navigation.write.mock.calls[0][1]?.state };
        rerender();
        act(() => result.current.setUSStatesVisible(true));
        expect(navigation.write.mock.lastCall?.[0].toString()).toBe('color=year&usStates=1');
    });

    it('recognizes an external PUSH to a query that matches an earlier internal write', () => {
        const { result, rerender } = renderHook(useFlightsFilters);
        act(() => result.current.setColorMode('year'));
        act(() => result.current.setAllAirportsVisible(true));
        navigation.params = new URLSearchParams('color=year');
        navigation.location = { key: 'external', state: null };
        rerender();
        act(() => result.current.setUSStatesVisible(true));
        expect(navigation.write.mock.lastCall?.[0].toString()).toBe('color=year&usStates=1');
    });

    it('distinguishes repeated query text across separate internal navigations', () => {
        const { result, rerender } = renderHook(useFlightsFilters);
        act(() => result.current.setColorMode('year'));
        act(() => result.current.setAllAirportsVisible(true));
        act(() => result.current.setAllAirportsVisible(false));
        for (const index of [0, 1]) {
            navigation.params = new URLSearchParams(navigation.write.mock.calls[index][0]);
            navigation.location = { key: `write-${index}`, state: navigation.write.mock.calls[index][1]?.state };
            rerender();
        }
        act(() => result.current.setUSStatesVisible(true));
        expect(navigation.write.mock.lastCall?.[0].toString()).toBe('color=year&usStates=1');
    });

    it('recognizes Back before a pending write commits even when the query and navigation type remain unchanged', () => {
        navigation.type = 'POP';
        const { result, rerender } = renderHook(useFlightsFilters);
        act(() => result.current.setColorMode('year'));
        navigation.location = { key: 'back-to-same-query', state: null };
        rerender();
        act(() => result.current.setUSStatesVisible(true));
        expect(navigation.write.mock.lastCall?.[0].toString()).toBe('usStates=1');
    });
});
