import { ProjectScreenshotGallery, type ProjectScreenshot } from '../components/ProjectScreenshotGallery';
import { useDocumentHead } from '../hooks/useDocumentHead';
import { useJsonLd } from '../hooks/useJsonLd';
import { AUTHOR_PERSON, absoluteUrl } from '../utils/siteMetadata';
import { projects } from '../content/projects';
import { ProjectChangelog } from '../components/ProjectChangelog';

const THROUGH_ROUTES_URL = 'https://through-routes.rsmb.tv/';

const screenshots: ProjectScreenshot[] = [
    {
        src: '/images/through-routes/through-routes-curviness-map.webp',
        alt: 'Through Routes map of the Midwest with roads colored by curviness score and filter controls',
        caption: 'Curviness heat map — roads colored red-to-blue by twist score with filters for road type, length, and surface',
        width: 1856,
        height: 1394,
        loading: 'eager',
    },
    {
        src: '/images/through-routes/through-routes-overview.webp',
        alt: 'Through Routes overview map showing a broad region with roads scored by curviness',
        caption: 'Regional overview — Northern California road network scored by curviness, showing dense rural riding terrain east of the Bay',
        width: 1860,
        height: 1391,
    },
    {
        src: '/images/through-routes/through-routes-road-detail.webp',
        alt: 'Road detail panel for US 2 near Seattle showing flow score 6.3, curvature metrics, elevation gain, and road geometry stats',
        caption: 'Road detail — US 2 near Seattle: flow score 6.3, length 11.4 mi, 180 m elevation gain, curvature/mile metrics, and surface data',
        width: 1862,
        height: 1395,
    },
];

export default function ThroughRoutes() {
    const description =
        'Find scenic, twisty motorcycle loop routes on rural roads using OpenStreetMap data.';

    useDocumentHead({
        title: 'Through Routes',
        description,
        ogImage: absoluteUrl('/og/through-routes.svg'),
    });

    useJsonLd({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Through Routes',
        description,
        url: THROUGH_ROUTES_URL,
        applicationCategory: 'TravelApplication',
        operatingSystem: 'Web',
        author: AUTHOR_PERSON,
    });

    const project = projects.find(p => p.slug === 'through-routes')!;

    return (
        <div className="max-w-2xl">
            <h1 className="text-2xl font-semibold text-zinc-100 mb-2">
                Through Routes
            </h1>
            <p className="text-zinc-400 mb-6 text-sm">
                Python + TypeScript
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

            <div className="mb-8 flex flex-wrap gap-3">
                <a
                    href={THROUGH_ROUTES_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500"
                >
                    Open Through Routes →
                </a>
                <a
                    href="https://github.com/robert-bryson/through-routes"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-700"
                >
                    Source on GitHub →
                </a>
            </div>

            <ProjectScreenshotGallery screenshots={screenshots} />

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
            <ProjectChangelog entries={project.changelog ?? []} />
        </div>
    );
}
