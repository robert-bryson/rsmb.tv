import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import { PostRegionFilters } from '../../../src/components/PostRegionFilters';
import '../../../src/index.css';

const countries = [
    { code: 'US', name: 'United States', count: 20, regions: [
        'Washington', 'Oregon', 'California', 'Idaho', 'Colorado', 'Nevada', 'Utah', 'Alaska',
    ].map((name, index) => ({ name, count: 8 - index })) },
    { code: 'CA', name: 'Canada', count: 12, regions: [
        'British Columbia', 'Alberta', 'Ontario', 'Quebec', 'Manitoba', 'Saskatchewan',
    ].map((name, index) => ({ name, count: 6 - index })) },
    { code: 'CL', name: 'Chile', count: 1, regions: [
        { name: 'Región del Libertador General Bernardo O’Higgins', count: 1 },
    ] },
    { code: 'GS', name: 'South Georgia & South Sandwich Islands', count: 1, regions: [] },
];

export function RegionFiltersFixture() {
    const [params] = useSearchParams();
    return <main className="mx-auto w-full max-w-5xl p-6">
        <PostRegionFilters
            countries={countries}
            activeCountry={params.get('country') ?? ''}
            activeRegion={params.get('region') ?? ''}
            createUrl={(country = '', region = '') => {
                const search = new URLSearchParams();
                if (country) search.set('country', country);
                if (region) search.set('region', region);
                return `/posts?${search}`;
            }}
        />
    </main>;
}

createRoot(document.getElementById('root')!).render(<StrictMode>
    <MemoryRouter initialEntries={[`/posts${window.location.search}`]}><RegionFiltersFixture /></MemoryRouter>
</StrictMode>);
