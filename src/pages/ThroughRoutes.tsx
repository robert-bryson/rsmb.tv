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
        alt: 'Through Routes map of the Ozarks with roads colored by curviness score and filter controls',
        caption: 'Curviness map — explore scored motorcycle roads with the current color scale and road filters.',
        width: 1600,
        height: 1000,
        loading: 'eager',
    },
    {
        src: '/images/through-routes/through-routes-overview.webp',
        alt: 'Through Routes overview map with roads scored by curviness and the basemap, scenic stop, and amenity layer controls open',
        caption: 'Map layers — choose a basemap and show roads, labels, fuel, gates, scenic stops, and amenities independently.',
        width: 1600,
        height: 1000,
    },
    {
        src: '/images/through-routes/through-routes-road-detail.webp',
        alt: 'Road detail panel with the selected road highlighted and its curvature and elevation profile',
        caption: 'Road detail — inspect the selected road, its ride-quality score, curvature and elevation profile, and riding metrics.',
        width: 1600,
        height: 1000,
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
                        data to score roads by curvature and ride quality. Inspect road
                        profiles and hairpins, find scenic stops, assemble routes with undo
                        and redo, or generate loops and export GPX.
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
                <li>Expanded road profiles with curvature, elevation, grade, and scored hairpin locations</li>
                <li>Independent basemap, road, scenic stop, and amenity controls</li>
                <li>Route Builder with saved drafts, undo and redo, connection checks, and GPX export</li>
                <li>Shared map views with road selection, filters, and independent unit preferences</li>
                <li>Dockerized backend with a FastAPI REST API</li>
            </ul>

            <h2 className="text-lg font-medium text-zinc-100 mb-3">Tech Stack</h2>
            <TechBadges tech={project.tech} className="mb-8" />
            <ProjectChangelog entries={project.changelog ?? []} />
        </div>
    );
}
