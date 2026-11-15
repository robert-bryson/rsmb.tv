import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { PostRegionFilters } from '../components/PostRegionFilters';
import { createBlogRegionSearch } from '../content/blogRegions';

const countries = [{
    code: 'US', name: 'United States', count: 4,
    regions: ['Washington', 'Oregon', 'California', 'Alaska'].map(name => ({ name, count: 1 })),
}];

function renderFilters(country = '', region = '') {
    return render(<MemoryRouter><PostRegionFilters
        countries={countries} activeCountry={country} activeRegion={region}
        createUrl={(country, region) => `/posts${createBlogRegionSearch(country, region)}`}
    /></MemoryRouter>);
}

describe('post region filters', () => {
    it('shows every region in the supplied order without another disclosure', () => {
        renderFilters();
        const group = within(screen.getByRole('group', { name: 'United States' }));
        expect(group.getAllByRole('link').map(link => link.textContent)).toEqual([
            'United States', 'Washington1', 'Oregon1', 'California1', 'Alaska1',
        ]);
        expect(group.queryByRole('button')).not.toBeInTheDocument();
        expect(group.getByRole('link', { name: /Washington/ })).toHaveAttribute('href', '/posts?country=US&region=washington');
    });

    it.each([
        ['', '', 'All regions'],
        ['US', '', 'United States'],
        ['US', 'alaska', 'Alaska'],
    ])('marks the selection for country %s and region %s', (country, region, label) => {
        renderFilters(country, region);
        const links = within(screen.getByRole('navigation', { name: 'Post regions' })).getAllByRole('link');
        expect(links.filter(link => link.getAttribute('aria-current') === 'page')).toHaveLength(1);
        expect(links.find(link => link.textContent?.startsWith(label))).toHaveAttribute('aria-current', 'page');
    });

    it('keeps unassigned regions selectable without inventing a country', () => {
        render(<MemoryRouter><PostRegionFilters
            countries={[{ code: '', name: 'Other regions', count: 1, regions: [{ name: 'Coast', count: 1 }] }]}
            activeCountry="" activeRegion="coast" createUrl={(country, region) => `/posts${createBlogRegionSearch(country, region)}`}
        /></MemoryRouter>);
        expect(screen.getByRole('link', { name: /Coast/ })).toHaveAttribute('href', '/posts?region=coast');
        expect(screen.getByRole('link', { name: /Coast/ })).toHaveAttribute('aria-current', 'page');
        expect(screen.queryByRole('link', { name: 'Other regions' })).not.toBeInTheDocument();
    });

    it.each([0, 1, 2])('describes %s posts when a country has no region list', count => {
        render(<MemoryRouter><PostRegionFilters
            countries={[{ code: 'JP', name: 'Japan', count, regions: [] }]}
            activeCountry="" activeRegion="" createUrl={country => `/posts?country=${country}`}
        /></MemoryRouter>);
        const group = within(screen.getByRole('group', { name: 'Japan' }));
        expect(group.getByRole('link', { name: 'Japan' })).toHaveAttribute('href', '/posts?country=JP');
        expect(group.getByText(`${count} ${count === 1 ? 'post' : 'posts'}`)).toBeInTheDocument();
    });
});
