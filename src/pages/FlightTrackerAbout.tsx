import { Link } from 'react-router-dom';
import { useDocumentHead } from '../hooks/useDocumentHead';
import { useJsonLd } from '../hooks/useJsonLd';

export default function FlightTrackerAbout() {
    useDocumentHead({
        title: 'Flight Tracker',
        description:
            'An interactive 3D globe visualization of flights around the world — filter by year, see route frequencies, and explore travel statistics.',
        ogImage: 'https://rsmb.tv/og/flights.svg',
    });

    useJsonLd({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Flight Tracker',
        description: 'An interactive 3D globe visualization of flights around the world — filter by year, see route frequencies, and explore travel statistics.',
        url: 'https://rsmb.tv/projects/flights',
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Web',
        author: { '@type': 'Person', name: 'Robby Bryson', url: 'https://rsmb.tv' },
    });

    return (
        <div className="max-w-2xl">
            <h1 className="text-2xl font-semibold text-zinc-100 mb-2">
                Flight Tracker
            </h1>
            <p className="text-zinc-500 mb-6 text-sm">
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
                    className="text-violet-400 hover:underline"
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
