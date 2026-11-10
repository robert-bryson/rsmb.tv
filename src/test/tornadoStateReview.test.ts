import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import { useTornadoFilters } from '../features/tornadoes/hooks/useTornadoFilters';

const wrapper = ({ children }: { children: ReactNode }) => createElement(MemoryRouter, { initialEntries: ['/tornadoes?state=ZZ&region=plains'] }, children);

it('ignores unknown two-letter states from links and state selection', () => {
    const { result } = renderHook(useTornadoFilters, { wrapper });
    expect(result.current.filters.selectedState).toBeNull();
    expect(result.current.filters.region).toBe('plains');
    act(() => result.current.selectState('ZZ'));
    expect(result.current.filters.selectedState).toBeNull();
    expect(result.current.filters.mode).toBe('tracks');
    act(() => result.current.selectState('pr'));
    expect(result.current.filters.selectedState).toBe('PR');
    expect(result.current.filters.mode).toBe('trends');
});
