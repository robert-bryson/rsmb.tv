import { useDocumentHead } from '../hooks/useDocumentHead';
import { useJsonLd } from '../hooks/useJsonLd';

export default function Route2Gpx() {
    useDocumentHead({
        title: 'route2gpx',
        description:
            'Convert Google Routes into GPX files for GPS devices and bike computers — a privacy-focused web app that runs entirely in your browser.',
        ogImage: 'https://rsmb.tv/og/route2gpx.svg',
    });

    useJsonLd({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'route2gpx',
        description: 'Convert Google Routes into GPX files for GPS devices and bike computers — a privacy-focused web app that runs entirely in your browser.',
        url: 'https://route2gpx.rsmb.tv',
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Web',
        author: { '@type': 'Person', name: 'Robby Bryson', url: 'https://rsmb.tv' },
    });

    return (
        <div className="max-w-2xl">
            <h1 className="text-2xl font-semibold text-zinc-100 mb-2">
                route2gpx
            </h1>
            <p className="text-zinc-500 mb-6 text-sm">
                2024 · JavaScript + Leaflet
            </p>

            <p className="text-zinc-300 leading-relaxed mb-6">
                Convert{' '}
                <a
                    href="https://developers.google.com/maps/documentation/routes"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-400 hover:underline"
                >
                    Google Routes
                </a>{' '}
                into GPX files for GPS devices and bike computers. A
                privacy-focused web app that runs entirely in your browser —
                your routes never touch a server.
            </p>

            <h2 className="text-lg font-medium text-zinc-100 mb-3">Features</h2>
            <ul className="space-y-1.5 text-zinc-400 text-sm mb-6 list-disc list-inside">
                <li>Paste a Google Maps route URL and get a downloadable GPX file</li>
                <li>Preview the route on an interactive Leaflet map before downloading</li>
                <li>Supports driving, cycling, and walking routes</li>
                <li>Entirely client-side — no data leaves your browser</li>
                <li>Works with Garmin, Wahoo, and other GPX-compatible devices</li>
            </ul>

            <h2 className="text-lg font-medium text-zinc-100 mb-3">How It Works</h2>
            <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                The app extracts route data from Google Maps URLs, decodes the
                polyline geometry, and converts it into standard GPX format with
                waypoints and track segments. Everything happens in-browser
                using the Google Routes API with your own API key.
            </p>

            <h2 className="text-lg font-medium text-zinc-100 mb-3">Tech Stack</h2>
            <div className="flex flex-wrap gap-2 mb-8">
                {['JavaScript', 'Leaflet', 'Google Routes API', 'GPX'].map(
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

            <div className="flex gap-4 text-sm">
                <a
                    href="https://route2gpx.rsmb.tv"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-400 hover:underline"
                >
                    Visit route2gpx ↗
                </a>
                <a
                    href="https://github.com/robert-bryson/route2gpx"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-400 hover:underline"
                >
                    Source on GitHub ↗
                </a>
            </div>
        </div>
    );
}
