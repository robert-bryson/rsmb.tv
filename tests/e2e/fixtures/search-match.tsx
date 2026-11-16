import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Link, MemoryRouter, useLocation } from 'react-router-dom';
import { Layout } from '../../../src/components/Layout';
import { SearchMatch } from '../../../src/components/SearchMatch';
import { ScrollToTop } from '../../../src/components/ScrollToTop';
import { RouteOrientation } from '../../../src/components/RouteOrientation';
import { useTripChapterHeadings } from '../../../src/features/trips/useTripChapterHeadings';
import '../../../src/index.css';

const mode = new URLSearchParams(window.location.search).get('case') ?? 'summary';

function TripDestination() {
    const registerHeading = useTripChapterHeadings();
    return <article className="trip-story"><div><section className="trip-chapter">
        <h2 ref={registerHeading} className="text-3xl font-bold">A long chapter heading</h2>
        <div className="h-[600px]" /><p id="match">Quiet harbor.</p><div className="h-[800px]" />
    </section></div></article>;
}

function Destination() {
    if (mode === 'summary') return <><h1>Disclosure</h1><details><summary id="match">Quiet harbor</summary><p>Details.</p></details><button>Next control</button></>;
    if (mode === 'transparent') return <><h1>Visibility</h1><div style={{ opacity: 0 }}><p id="invisible">Quiet harbor.</p></div><p id="match">A visible quiet harbor.</p></>;
    if (mode === 'code') return <><h1>Code</h1><pre id="scroller" className="w-full overflow-x-auto"><code>{'padding '.repeat(40)}quiet harbor</code></pre></>;
    if (mode === 'nested') return <><h1>Scrollable text</h1><div id="scroller" className="h-40 overflow-y-auto"><div className="h-[400px]" /><p id="match">Quiet harbor.</p><div className="h-[200px]" /></div></>;
    return <TripDestination />;
}

export function Fixture() {
    const location = useLocation();
    return <><ScrollToTop /><Layout><RouteOrientation /><SearchMatch />
        {location.pathname === '/start' ? <><h1>Search passage fixture</h1><Link to="/target" state={{ siteSearchQuery: 'quiet harbor' }}>Find passage</Link></> : <Destination />}
        <span hidden data-route-path={location.pathname} />
        <div aria-hidden="true" className="h-[120vh]" />
    </Layout></>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><MemoryRouter initialEntries={['/start']}><Fixture /></MemoryRouter></StrictMode>);
