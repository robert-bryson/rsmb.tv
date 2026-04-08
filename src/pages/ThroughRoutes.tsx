import { useDocumentHead } from '../hooks/useDocumentHead';
import { useJsonLd } from '../hooks/useJsonLd';

export default function ThroughRoutes() {
    useDocumentHead({
        title: 'Through Routes',
        description:
            'Find scenic, twisty motorcycle loop routes on rural roads using OpenStreetMap data.',
        ogImage: 'https://rsmb.tv/og/through-routes.svg',
    });

    useJsonLd({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Through Routes',
        description: 'Find scenic, twisty motorcycle loop routes on rural roads using OpenStreetMap data.',
        url: 'https://through-routes.rsmb.tv/',
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Web',
        author: { '@type': 'Person', name: 'Robby Bryson', url: 'https://rsmb.tv' },
    });

    return (
        <div className="max-w-2xl">
            <h1 className="text-2xl font-semibold text-zinc-100 mb-2">
                Through Routes
            </h1>
            <p className="text-zinc-400 mb-6 text-sm">
                2026 · Python + TypeScript
            </p>

            <p className="text-zinc-300 leading-relaxed mb-6">
                Find scenic, twisty motorcycle loop routes on rural roads.
                Through Routes processes{' '}
                <a
                    href="https://www.openstreetmap.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-400 underline decoration-violet-400/30 hover:decoration-violet-400"
                >
                    OpenStreetMap
                </a>{' '}
                data to build a loop-friendly road graph, scores roads by
                curviness and elevation change, and generates ranked circular
                routes from any start point.
            </p>

            <h2 className="text-lg font-medium text-zinc-100 mb-3">How It Works</h2>
            <ul className="space-y-1.5 text-zinc-400 text-sm mb-6 list-disc list-inside">
                <li>Ingests OSM road network data for a target region</li>
                <li>Builds a directed graph of road segments weighted by curviness and elevation gain</li>
                <li>Generates loop routes from a given start point using graph traversal</li>
                <li>Ranks routes by scenic score — favoring twisty, hilly, low-traffic roads</li>
                <li>Web UI for browsing and previewing routes on a map</li>
            </ul>

            <h2 className="text-lg font-medium text-zinc-100 mb-3">Features</h2>
            <ul className="space-y-1.5 text-zinc-400 text-sm mb-6 list-disc list-inside">
                <li>Curviness scoring based on road geometry deflection angles</li>
                <li>Elevation profile analysis using DEM data</li>
                <li>Configurable route distance and loop constraints</li>
                <li>Interactive map with route preview and elevation charts</li>
                <li>Dockerized backend with a FastAPI REST API</li>
            </ul>

            <h2 className="text-lg font-medium text-zinc-100 mb-3">Tech Stack</h2>
            <div className="flex flex-wrap gap-2 mb-8">
                {['Python', 'NumPy', 'FastAPI', 'TypeScript', 'MapLibre GL', 'Docker'].map(
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
                    href="https://through-routes.rsmb.tv/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-400 underline decoration-violet-400/30 hover:decoration-violet-400"
                >
                    Visit Through Routes ↗
                </a>
                <a
                    href="https://github.com/robert-bryson/through-routes"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-400 underline decoration-zinc-400/30 hover:decoration-zinc-400"
                >
                    Source on GitHub ↗
                </a>
            </div>
        </div>
    );
}
