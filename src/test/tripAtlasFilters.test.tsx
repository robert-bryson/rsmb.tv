import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BlogCountry } from '../content/blogRegions';
import { AtlasAppliedFilters, TripAtlasFilters } from '../features/trips/atlas/TripAtlasFilters';
import { emptyAtlasFilters } from '../features/trips/atlas/tripAtlasBrowser';

const countries: BlogCountry[] = [
    { code: 'CA', name: 'Canada', count: 2, regions: [{ name: 'British Columbia', count: 1 }, { name: 'Ontario', count: 1 }] },
    { code: 'US', name: 'United States', count: 1, regions: [{ name: 'Washington', count: 1 }] },
];

describe('atlas filter editing', () => {
    it('keeps edits local and allows cancellation without changing applied filters', () => {
        const onApply = vi.fn();
        const onCancel = vi.fn();
        const filters = { ...emptyAtlasFilters(), milesMin: '600.1', countries: ['CA'] };
        render(<TripAtlasFilters filters={filters} countries={countries} onApply={onApply} onCancel={onCancel} />);
        fireEvent.change(screen.getByLabelText('Minimum miles'), { target: { value: '700' } });
        fireEvent.click(screen.getByRole('checkbox', { name: 'Any region in Canada' }));
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onCancel).toHaveBeenCalledOnce();
        expect(onApply).not.toHaveBeenCalled();
        expect(filters).toMatchObject({ milesMin: '600.1', countries: ['CA'] });
    });

    it('narrows a country to regions and broadens it again without changing another country choice', () => {
        const onApply = vi.fn();
        render(<TripAtlasFilters filters={{ ...emptyAtlasFilters(), countries: ['CA', 'US'] }} countries={countries} onApply={onApply} onCancel={vi.fn()} />);
        const canada = within(screen.getByRole('group', { name: 'Canada' }));
        fireEvent.click(canada.getByRole('button', { name: 'States and provinces' }));
        fireEvent.click(canada.getByRole('checkbox', { name: 'British Columbia' }));
        expect(canada.getByRole('checkbox', { name: 'Any region in Canada' })).not.toBeChecked();
        fireEvent.click(canada.getByRole('checkbox', { name: 'Ontario' }));
        fireEvent.click(canada.getByRole('checkbox', { name: 'British Columbia' }));
        fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
        expect(onApply).toHaveBeenLastCalledWith(expect.objectContaining({ countries: ['US'], regions: ['CA/ontario'] }));
        fireEvent.click(canada.getByRole('checkbox', { name: 'Any region in Canada' }));
        expect(canada.getByRole('checkbox', { name: 'Ontario' })).not.toBeChecked();
        fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
        expect(onApply).toHaveBeenLastCalledWith(expect.objectContaining({ countries: ['US', 'CA'], regions: [] }));
    });

    it('focuses an invalid range, retains the draft, and accepts exact zero and fractional bounds after correction', () => {
        const onApply = vi.fn();
        render(<TripAtlasFilters filters={emptyAtlasFilters()} countries={[]} onApply={onApply} onCancel={vi.fn()} />);
        fireEvent.change(screen.getByLabelText('Minimum days'), { target: { value: '3' } });
        fireEvent.change(screen.getByLabelText('Maximum days'), { target: { value: '2' } });
        fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
        expect(screen.getByLabelText('Maximum days')).toHaveFocus();
        expect(screen.getByLabelText('Maximum days')).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByRole('alert')).toHaveTextContent('maximum must be at least the minimum');
        expect(onApply).not.toHaveBeenCalled();
        fireEvent.change(screen.getByLabelText('Minimum days'), { target: { value: '0' } });
        fireEvent.change(screen.getByLabelText('Minimum miles'), { target: { value: '600.1' } });
        fireEvent.change(screen.getByLabelText('Maximum miles'), { target: { value: '600.1' } });
        fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
        expect(onApply).toHaveBeenCalledExactlyOnceWith({ ...emptyAtlasFilters(), daysMin: '0', daysMax: '2', milesMin: '600.1', milesMax: '600.1' });
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('opens applied region choices, including locations without a known country', () => {
        const onApply = vi.fn();
        const locations = [...countries, { code: '', name: 'Other regions', count: 1, regions: [{ name: 'Unassigned', count: 1 }] }];
        render(<TripAtlasFilters filters={{ ...emptyAtlasFilters(), regions: ['CA/ontario', '/unassigned'] }} countries={locations} onApply={onApply} onCancel={vi.fn()} />);
        expect(screen.getByRole('checkbox', { name: 'Ontario' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'Unassigned' })).toBeChecked();
        expect(screen.queryByRole('checkbox', { name: 'Any region in Other regions' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('checkbox', { name: 'Unassigned' }));
        fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
        expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ regions: ['CA/ontario'] }));
    });
});

describe('applied atlas filters', () => {
    it('removes individual bounds and qualified locations while keeping other applied choices', () => {
        const onChange = vi.fn();
        const onClearSelected = vi.fn();
        const onClear = vi.fn();
        const filters = { ...emptyAtlasFilters(), milesMin: '600.1', countries: ['US'], regions: ['CA/ontario', 'CA/missing'] };
        render(<AtlasAppliedFilters filters={filters} countries={countries} onlySelected onChange={onChange} onClearSelected={onClearSelected} onClear={onClear} />);
        fireEvent.click(screen.getByRole('button', { name: 'Remove filter: Miles ≥ 600.1' }));
        expect(onChange).toHaveBeenLastCalledWith({ ...filters, milesMin: '' });
        fireEvent.click(screen.getByRole('button', { name: 'Remove filter: United States' }));
        expect(onChange).toHaveBeenLastCalledWith({ ...filters, countries: [] });
        fireEvent.click(screen.getByRole('button', { name: 'Remove filter: Ontario, Canada' }));
        expect(onChange).toHaveBeenLastCalledWith({ ...filters, regions: ['CA/missing'] });
        fireEvent.click(screen.getByRole('button', { name: 'Remove filter: CA/missing' }));
        expect(onChange).toHaveBeenLastCalledWith({ ...filters, regions: ['CA/ontario'] });
        fireEvent.click(screen.getByRole('button', { name: 'Remove filter: Selected trip only' }));
        expect(onClearSelected).toHaveBeenCalledOnce();
        fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
        expect(onClear).toHaveBeenCalledOnce();
    });

    it('leaves no empty applied-filter controls when nothing is selected', () => {
        render(<AtlasAppliedFilters filters={emptyAtlasFilters()} countries={countries} onlySelected={false} onChange={vi.fn()} onClearSelected={vi.fn()} onClear={vi.fn()} />);
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
});
