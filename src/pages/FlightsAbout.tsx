import { Link } from 'react-router-dom';
import { useDocumentHead } from '../hooks/useDocumentHead';
import { useJsonLd } from '../hooks/useJsonLd';
import { AUTHOR_PERSON, absoluteUrl } from '../utils/siteMetadata';

export default function FlightsAbout() {
    const description =
        'An interactive 3D globe visualization of flights around the world — filter by year, see route frequencies, and explore travel statistics.';

    useDocumentHead({
        title: 'Flights',
        description,
        ogImage: 'https://rsmb.tv/og/flights.svg',
    });

    useJsonLd({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Flights',
        description,
        url: absoluteUrl('/projects/flights'),
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Web',
        author: AUTHOR_PERSON,
    });

    return (
        <div className="max-w-2xl">
            <h1 className="text-2xl font-semibold text-zinc-100 mb-2">
                Flights
            </h1>
            <p className="text-zinc-400 mb-6 text-sm">
                2025 · React + Three.js
            </p>

            <p className="text-zinc-300 leading-relaxed mb-6">
                An interactive 3D globe visualization of flights I've taken
                around the world. Animated arcs trace each route across the
                globe, with filtering by year, airport, and airline. Built with{' '}
                <a
                    href="https://github.com/vasturiano/react-globe.gl"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-400 underline decoration-violet-400/30 hover:decoration-violet-400"
                >
                    react-globe.gl
                </a>{' '}
                (Three.js / WebGL) and GeoJSON flight data.
            </p>

            <div className="mb-8">
                <Link
                    to="/projects/flights/map"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
                >
                    Open interactive globe →
                </Link>
            </div>

            <div className="space-y-6 mb-8">
                <figure>
                    <img
                        src="/images/flights/flight-globe.webp"
                        alt="3D globe showing all flight routes with stats panel"
                        className="rounded-lg border border-zinc-800"
                        width={1852}
                        height={1385}
                        loading="eager"
                    />
                    <figcaption className="mt-2 text-xs text-zinc-400 text-center">
                        Overview of all flights on the interactive 3D globe with aggregate statistics, airline breakdown, and country-level data
                    </figcaption>
                </figure>
                <figure>
                    <img
                        src="/images/flights/flight-routes.webp"
                        alt="Globe filtered to show routes from Seattle-Tacoma International Airport"
                        className="rounded-lg border border-zinc-800"
                        width={1853}
                        height={1389}
                        loading="lazy"
                    />
                    <figcaption className="mt-2 text-xs text-zinc-400 text-center">
                        Filtering by airport — all routes from Seattle-Tacoma (SEA) with visit timeline, top destinations, and connected airports
                    </figcaption>
                </figure>
                <figure>
                    <img
                        src="/images/flights/flight-stats.webp"
                        alt="Globe zoomed into the United Kingdom showing airport markers and flight routes"
                        className="rounded-lg border border-zinc-800"
                        width={1860}
                        height={1390}
                        loading="lazy"
                    />
                    <figcaption className="mt-2 text-xs text-zinc-400 text-center">
                        Country view — flights to and from the United Kingdom with airport markers, top routes, and airline details
                    </figcaption>
                </figure>
            </div>

            <h2 className="text-lg font-medium text-zinc-100 mb-3">Features</h2>
            <ul className="space-y-1.5 text-zinc-400 text-sm mb-6 list-disc list-inside">
                <li>3D globe with animated flight arcs using WebGL</li>
                <li>Filter by year, airport, or airline</li>
                <li>Color modes — by airline, frequency, or distance</li>
                <li>Route frequency visualization showing most-traveled paths</li>
                <li>Deep-linking support for sharing specific views</li>
                <li>Mobile-optimized touch controls</li>
            </ul>

            <h2 className="text-lg font-medium text-zinc-100 mb-3">Data Pipeline</h2>
            <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                Raw flight and airport data lives in CSV files, processed by
                Node.js build scripts into GeoJSON for the globe. The pipeline
                generates airport points, flight arcs, US state boundaries, and
                visited-airport markers — all served as static files.
            </p>

            <h2 className="text-lg font-medium text-zinc-100 mb-3">Tech Stack</h2>
            <div className="flex flex-wrap gap-2 mb-8">
                {['React', 'Three.js', 'WebGL', 'react-globe.gl', 'GeoJSON', 'Node.js'].map(
                    (t) => (
                        <span
                            key={t}
                            className="px-2 py-0.5 text-xs rounded-full bg-zinc-800 text-zinc-400"
                        >
                            {t}
                        </span>
                    ),
                )}
            </div>
        </div>
    );
}
