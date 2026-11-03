import { ProjectPageHeader } from '../components/ProjectPageHeader';
import { ProjectScreenshotGallery, type ProjectScreenshot } from '../components/ProjectScreenshotGallery';
import { TechBadges } from '../components/TechBadges';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { staticPageMetadata } from '../utils/pageMetadata';
import { projects } from '../content/projects';
import { ProjectChangelog } from '../components/ProjectChangelog';

const screenshots: ProjectScreenshot[] = [
    {
        src: '/images/flights/flight-globe.webp',
        alt: '3D globe showing all flight routes with stats panel',
        caption: 'Overview of all flights on the interactive 3D globe with aggregate statistics, airline breakdown, and country-level data',
        width: 1852,
        height: 1385,
        loading: 'eager',
    },
    {
        src: '/images/flights/flight-routes.webp',
        alt: 'Globe filtered to show routes from Seattle-Tacoma International Airport',
        caption: 'Filtering by airport — all routes from Seattle-Tacoma (SEA) with visit timeline, top destinations, and connected airports',
        width: 1853,
        height: 1389,
        loading: 'lazy',
    },
    {
        src: '/images/flights/flight-stats.webp',
        alt: 'Globe zoomed into the United Kingdom showing airport markers and flight routes',
        caption: 'Country view — flights to and from the United Kingdom with airport markers, top routes, and airline details',
        width: 1860,
        height: 1390,
        loading: 'lazy',
    },
];

export default function FlightsAbout() {
    usePageMetadata(staticPageMetadata('/projects/flights'));

    const project = projects.find(p => p.slug === 'flights')!;

    return (
        <div className="max-w-[52rem]">
            <ProjectPageHeader
                title="Flights"
                stack="React + Three.js"
                description={(
                    <>
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
                    </>
                )}
                actions={[
                    { label: 'Open interactive globe →', href: '/projects/flights/map', variant: 'primary' },
                    { label: 'Source on GitHub →', href: 'https://github.com/robert-bryson/rsmb.tv/tree/main/src/features/flights', external: true },
                ]}
            />

            <ProjectScreenshotGallery screenshots={screenshots} />

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
                Flight time measures gate-to-gate travel. Recorded durations take precedence over distance estimates.
                Statistics show how many flights use actual, scheduled, or estimated time. Individual route entries
                show hours and minutes with their timing basis and source.
            </p>
            <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                Raw flight and airport data lives in CSV files, processed by
                Node.js build scripts into GeoJSON for the globe. The pipeline
                generates airport points, flight arcs, US state boundaries, and
                visited-airport markers — all served as static files.
            </p>

            <h2 className="text-lg font-medium text-zinc-100 mb-3">Tech Stack</h2>
            <TechBadges tech={['React', 'Three.js', 'WebGL', 'react-globe.gl', 'GeoJSON', 'Node.js']} className="mb-8" />
            <ProjectChangelog entries={project.changelog ?? []} />
        </div>
    );
}
