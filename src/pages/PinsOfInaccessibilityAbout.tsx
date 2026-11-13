import { ProjectPageHeader } from '../components/ProjectPageHeader';
import { TechBadges } from '../components/TechBadges';
import { ProjectChangelog } from '../components/ProjectChangelog';
import { ProjectScreenshotGallery } from '../components/ProjectScreenshotGallery';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { staticPageMetadata } from '../utils/pageMetadata';
import { projects } from '../content/projects';

export default function PinsOfInaccessibilityAbout() {
    usePageMetadata(staticPageMetadata('/projects/pins-of-inaccessibility'));
    const project = projects.find(project => project.slug === 'pins-of-inaccessibility')!;
    return <div>
        <ProjectPageHeader title={project.title} stack="React + MapLibre GL · Census TIGER/Line · Python"
            description={<>How far can you get from every edge of a place? A pole of inaccessibility is the point with the greatest distance to its nearest boundary. This map finds that point for the United States and for each state, inhabited territory, and county, then draws the largest circle that fits inside.</>}
            actions={[
                { label: 'Open interactive map →', href: project.demoUrl!, variant: 'primary' },
                { label: 'Source on GitHub →', href: project.sourceUrl!, external: true },
                { label: 'Census source data →', href: 'https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html', external: true, analyticsDestination: 'data' },
            ]} />
        <ProjectScreenshotGallery screenshots={[{
            src: '/images/pins-of-inaccessibility/overview.webp', width: 1440, height: 960, loading: 'eager',
            alt: 'Map of the national U.S. pole in violet and state interior pins with amber radius circles',
            caption: 'The U.S. overview compares the national and state pins and their distances to a nearest administrative boundary.',
        }, {
            src: '/images/pins-of-inaccessibility/radius-detail.webp', width: 1280, height: 720, loading: 'lazy',
            alt: 'Colorado interior pin with two dashed radius lines and distance badges at the nearest state boundaries',
            caption: 'Zoomed radius details connect the pin to nearby boundary contacts and label each measured distance.',
        }]} />
        <h2 className="mb-3 text-lg font-medium text-zinc-100">Explore the interior</h2>
        <ul className="mb-7 list-inside list-disc space-y-2 text-sm leading-relaxed text-zinc-400">
            <li>A national U.S. pole with a distinct violet pin, radius circle, and zoom shortcut.</li>
            <li>56 jurisdiction pins: 50 states, Washington, DC, and five inhabited U.S. territories.</li>
            <li>County equivalents include parishes, boroughs, census areas, independent cities, planning regions, and territorial districts.</li>
            <li>Optional radius circles and labeled spokes show distances to the nearest boundary contacts as you zoom in.</li>
            <li>County pins appear automatically at zoom level 6. Switch the layer off or keep it on at every zoom.</li>
            <li>Search by name, state abbreviation, or FIPS code. Compare the largest and smallest radii, then click to zoom.</li>
            <li>Use miles or kilometers. Copy the address of a selected pin to share it.</li>
        </ul>
        <h2 className="mb-3 text-lg font-medium text-zinc-100">What counts as an edge?</h2>
        <p className="mb-5 text-sm leading-relaxed text-zinc-400">The map uses administrative boundaries, including jurisdictional water. Inland lake shores add no extra edges. Enclaves remain holes: an independent city inside a county is a separate jurisdiction. A pin can lie over water. Coastal edges follow Census jurisdiction limits, which can extend offshore.</p>
        <p className="mb-5 text-sm leading-relaxed text-zinc-400">For the national pole, the covered state and territory polygons are merged. Internal state borders do not count. International borders and coastal jurisdiction limits define the national circle.</p>
        <h2 className="mb-3 text-lg font-medium text-zinc-100">How the calculation works</h2>
        <p className="mb-5 text-sm leading-relaxed text-zinc-400">A Python pipeline reads the full 2025 Census TIGER/Line boundaries. It checks disconnected pieces separately, then solves for the largest inscribed circle in a local WGS84 azimuthal equidistant projection. The projection is recentered at the candidate pin to improve radial distances. The final radius is checked against the original boundary.</p>
        <p className="mb-7 text-sm leading-relaxed text-zinc-400">Results are approximate. The solver uses a 25-meter search tolerance and 20-meter boundary simplification. These values describe the algorithm, not source-boundary accuracy. Display outlines are simplified separately. The Census files omit minor outlying islands. Read about the original <a className="text-violet-400 underline" href="https://en.wikipedia.org/wiki/Pole_of_inaccessibility" target="_blank" rel="noreferrer">pole of inaccessibility concept</a>.</p>
        <h2 className="mb-3 text-lg font-medium text-zinc-100">Built with shared components</h2>
        <p className="mb-5 text-sm leading-relaxed text-zinc-400">This project shares the site’s MapLibre worker setup, CARTO basemaps, background recovery, validated request cache, state identities, navigation, project presentation, and display preferences. The map uses static precomputed data; it needs no application server.</p>
        <TechBadges tech={project.tech} className="mb-8" />
        <ProjectChangelog entries={project.changelog ?? []} />
    </div>;
}
