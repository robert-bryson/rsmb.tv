import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BlogCountry } from '../content/blogRegions';
import { AtlasAppliedFilters, TripAtlasFilters } from '../features/trips/atlas/TripAtlasFilters';
import { emptyAtlasFilters } from '../features/trips/atlas/tripAtlasBrowser';
import type { AtlasFilterOptions } from '../features/trips/atlas/tripAtlasFilterOptions';

const options: AtlasFilterOptions = {
    year: [{ min: '', max: '', label: 'Any year' }, { min: '2024-01-01', max: '2024-12-31', label: '2024' }],
    days: [{ min: '', max: '', label: 'Any number of days' }, { min: '1', max: '3', label: '1–3 days' }],
    miles: [{ min: '', max: '', label: 'Any distance' }, { min: '', max: '500', label: 'Up to 500 miles' }],
};

const countries: BlogCountry[] = [
    { code: 'CA', name: 'Canada', count: 2, regions: [{ name: 'British Columbia', count: 1 }, { name: 'Ontario', count: 1 }] },
    { code: 'US', name: 'United States', count: 1, regions: [{ name: 'Washington', count: 1 }] },
];

describe('atlas filter editing', () => {
    it('offers a year picker, applies its calendar year, and retains precise shared dates until changed', () => {
        const onApply = vi.fn();
        const filters = { ...emptyAtlasFilters(), from: '2024-05-11', to: '2024-05-19' };
        render(<TripAtlasFilters filters={filters} countries={[]} options={options} onApply={onApply} onCancel={vi.fn()} />);
        expect(screen.getByLabelText('Trip year', { exact: true })).toHaveDisplayValue('2024-05-11 – 2024-05-19');
        expect(screen.queryByLabelText('From date')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
        expect(onApply).toHaveBeenLastCalledWith(filters);
        fireEvent.change(screen.getByLabelText('Trip year'), { target: { value: '2024-01-01/2024-12-31' } });
        fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
        expect(onApply).toHaveBeenLastCalledWith({ ...filters, from: '2024-01-01', to: '2024-12-31' });
    });

    it('keeps edits local and allows cancellation without changing applied filters', () => {
        const onApply = vi.fn();
        const onCancel = vi.fn();
        const filters = { ...emptyAtlasFilters(), milesMin: '600.1', countries: ['CA'] };
        render(<TripAtlasFilters filters={filters} countries={countries} options={options} onApply={onApply} onCancel={onCancel} />);
        fireEvent.change(screen.getByLabelText('Distance'), { target: { value: '/500' } });
        fireEvent.click(screen.getByRole('checkbox', { name: 'Any region in Canada' }));
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onCancel).toHaveBeenCalledOnce();
        expect(onApply).not.toHaveBeenCalled();
        expect(filters).toMatchObject({ milesMin: '600.1', countries: ['CA'] });
    });

    it('narrows a country to regions and broadens it again without changing another country choice', () => {
        const onApply = vi.fn();
        render(<TripAtlasFilters filters={{ ...emptyAtlasFilters(), countries: ['CA', 'US'] }} countries={countries} options={options} onApply={onApply} onCancel={vi.fn()} />);
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

    it('retains exact shared bounds and lets a preset correct an invalid range', () => {
        const onApply = vi.fn();
        const filters = { ...emptyAtlasFilters(), daysMin: '3', daysMax: '2', milesMin: '600.1', milesMax: '600.1' };
        render(<TripAtlasFilters filters={filters} countries={[]} options={options} onApply={onApply} onCancel={vi.fn()} />);
        expect(screen.getByLabelText('Distance')).toHaveDisplayValue('600.1 miles');
        fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
        expect(screen.getByLabelText('Riding days')).toHaveFocus();
        expect(screen.getByLabelText('Riding days')).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByRole('alert')).toHaveTextContent('maximum must be at least the minimum');
        expect(onApply).not.toHaveBeenCalled();
        fireEvent.change(screen.getByLabelText('Riding days'), { target: { value: '1/3' } });
        fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
        expect(onApply).toHaveBeenCalledExactlyOnceWith({ ...filters, daysMin: '1', daysMax: '3' });
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('opens applied region choices, including locations without a known country', () => {
        const onApply = vi.fn();
        const locations = [...countries, { code: '', name: 'Other regions', count: 1, regions: [{ name: 'Unassigned', count: 1 }] }];
        render(<TripAtlasFilters filters={{ ...emptyAtlasFilters(), regions: ['CA/ontario', '/unassigned'] }} countries={locations} options={options} onApply={onApply} onCancel={vi.fn()} />);
        expect(screen.getByRole('checkbox', { name: 'Ontario' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'Unassigned' })).toBeChecked();
        expect(screen.queryByRole('checkbox', { name: 'Any region in Other regions' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('checkbox', { name: 'Unassigned' }));
        fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
        expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ regions: ['CA/ontario'] }));
    });
});

describe('applied atlas filters', () => {
    it('removes a complete year or range without changing the other chosen ranges', () => {
        const onChange = vi.fn();
        const filters = { ...emptyAtlasFilters(), from: '2024-01-01', to: '2024-12-31', daysMin: '4', daysMax: '7' };
        render(<AtlasAppliedFilters filters={filters} countries={[]} onlySelected={false} onChange={onChange} onClearSelected={vi.fn()} onClear={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'Remove filter: Year: 2024' }));
        expect(onChange).toHaveBeenLastCalledWith({ ...filters, from: '', to: '' });
        fireEvent.click(screen.getByRole('button', { name: 'Remove filter: 4–7 days' }));
        expect(onChange).toHaveBeenLastCalledWith({ ...filters, daysMin: '', daysMax: '' });
    });

    it('removes individual bounds and qualified locations while keeping other applied choices', () => {
        const onChange = vi.fn();
        const onClearSelected = vi.fn();
        const onClear = vi.fn();
        const filters = { ...emptyAtlasFilters(), milesMin: '600.1', countries: ['US'], regions: ['CA/ontario', 'CA/missing'] };
        render(<AtlasAppliedFilters filters={filters} countries={countries} onlySelected onChange={onChange} onClearSelected={onClearSelected} onClear={onClear} />);
        fireEvent.click(screen.getByRole('button', { name: 'Remove filter: 600.1+ miles' }));
        expect(onChange).toHaveBeenLastCalledWith({ ...filters, milesMin: '', milesMax: '' });
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
