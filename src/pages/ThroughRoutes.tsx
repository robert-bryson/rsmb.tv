import { ProjectPageHeader } from '../components/ProjectPageHeader';
import { TechBadges } from '../components/TechBadges';
import { ProjectScreenshotGallery, type ProjectScreenshot } from '../components/ProjectScreenshotGallery';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { staticPageMetadata } from '../utils/pageMetadata';
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
    usePageMetadata(staticPageMetadata('/projects/through-routes'));

    const project = projects.find(p => p.slug === 'through-routes')!;

    return (
        <div className="max-w-[52rem]">
            <ProjectPageHeader
                title="Through Routes"
                stack="Python + TypeScript"
                description={(
                    <>
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
                    </>
                )}
                actions={[
                    { label: 'Open Through Routes →', href: THROUGH_ROUTES_URL, variant: 'primary', external: true },
                    { label: 'Source on GitHub →', href: 'https://github.com/robert-bryson/through-routes', external: true },
                ]}
            />

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
            <TechBadges tech={project.tech} className="mb-8" />
            <ProjectChangelog entries={project.changelog ?? []} />
        </div>
    );
}
