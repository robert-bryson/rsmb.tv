import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation, useSearchParams } from 'react-router-dom';
import { PostRegionFilters } from '../../../src/components/PostRegionFilters';
import { PostFilters } from '../../../src/components/PostFilters';
import { Layout } from '../../../src/components/Layout';
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
    const location = useLocation();
    return <Layout>
        <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-bold">Post filters</h1>
            <PostFilters count={Number(!!(params.get('country') || params.get('region')))}>
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
            </PostFilters>
        </div>
        <output data-testid="region-url" className="sr-only">{location.pathname + location.search}</output>
        <div aria-hidden="true" className="h-[150vh]" />
    </Layout>;
}

createRoot(document.getElementById('root')!).render(<StrictMode>
    <MemoryRouter initialEntries={[`/posts${window.location.search}`]}><RegionFiltersFixture /></MemoryRouter>
</StrictMode>);
