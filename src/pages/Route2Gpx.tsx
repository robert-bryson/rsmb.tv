import { usePageMetadata } from '../hooks/usePageMetadata';
import { staticPageMetadata } from '../utils/pageMetadata';
import { projects } from '../content/projects';
import { ProjectChangelog } from '../components/ProjectChangelog';
import { ProjectScreenshotGallery, type ProjectScreenshot } from '../components/ProjectScreenshotGallery';
import { ProjectPageHeader } from '../components/ProjectPageHeader';

const ROUTE2GPX_URL = 'https://route2gpx.rsmb.tv';

const screenshots: ProjectScreenshot[] = [
    {
        src: '/images/route2gpx/route-planning-v1-1.webp',
        alt: 'Route planner with a Seattle waterfront example track, location fields, route controls, and a Leaflet map',
        caption: 'Import a GPS track without a Google key, or plan a route with your own key. The map shows an example waterfront track.',
        width: 1440,
        height: 1000,
        loading: 'eager',
    },
    {
        src: '/images/route2gpx/download-formats-v1-1.webp',
        alt: 'Download popup with GPX, KML, GeoJSON, TCX, and CSV choices and a filename preview',
        caption: 'Select a format, check the filename, and download. Track data and optional time generation are available in the same popup.',
        width: 1440,
        height: 1000,
    },
    {
        src: '/images/route2gpx/multi-route-v1-1.webp',
        alt: 'Three example tracks around Seattle shown with different colors and separate route controls',
        caption: 'Compare tracks on one map. Rename, hide, or export a track, or download all tracks as a GPX ZIP.',
        width: 1440,
        height: 1000,
    },
];

export default function Route2Gpx() {
    usePageMetadata(staticPageMetadata('/projects/route2gpx'));
    const project = projects.find(p => p.slug === 'route2gpx')!;

    return (
        <div className="max-w-[52rem]">
            <ProjectPageHeader
                title="route2gpx"
                stack="JavaScript + Leaflet · Python CLI"
                description={(
                    <>
                        Plan routes or import GPS tracks, then download GPX, KML,
                        GeoJSON, TCX, or CSV. Inspect the full track on a map and
                        check its elevation and time coverage before export.
                        File imports and conversion run locally in your browser.
                    </>
                )}
                actions={[
                    { label: 'Open route2gpx →', href: ROUTE2GPX_URL, variant: 'primary', external: true },
                    { label: 'Source on GitHub →', href: 'https://github.com/robert-bryson/route2gpx', external: true },
                ]}
            />

            <ProjectScreenshotGallery screenshots={screenshots} />

            <h2 className="text-lg font-medium text-zinc-100 mb-3">Features</h2>
            <ul className="space-y-1.5 text-zinc-400 text-sm mb-6 list-disc list-inside">
                <li>Import GPX, KML, FIT, TCX, and GeoJSON, including gzip-compressed files and multiple files at once.</li>
                <li>Plan driving, cycling, walking, or transit routes with your own Google Routes API key.</li>
                <li>Add waypoints, reverse endpoints, reuse saved routes, and keep planner points visible on the map.</li>
                <li>Keep segment breaks, known elevations, and recorded times where the selected format supports them.</li>
                <li>Choose GPX, KML, GeoJSON, TCX, or CSV in a keyboard-accessible download popup.</li>
                <li>Compare tracks with separate colors and visibility controls. Download multiple routes as a GPX ZIP.</li>
                <li>Display a Fog of World ZIP as a separate map overlay.</li>
            </ul>

            <h2 className="text-lg font-medium text-zinc-100 mb-3">Choose an Output</h2>
            <ul className="space-y-1.5 text-zinc-400 text-sm mb-6 list-disc list-inside">
                <li><strong className="text-zinc-200">GPX:</strong> GPS devices, outdoor apps, and full track backups.</li>
                <li><strong className="text-zinc-200">KML:</strong> Google Earth and map sharing. Point times are omitted.</li>
                <li><strong className="text-zinc-200">GeoJSON:</strong> GIS and web maps. Recorded times use coordTimes properties; support varies by app.</li>
                <li><strong className="text-zinc-200">TCX:</strong> Fitness courses. Every point needs a time. Missing times require an explicit choice to generate estimates.</li>
                <li><strong className="text-zinc-200">CSV:</strong> Spreadsheet rows with segment and point numbers, coordinates, elevation in meters, and recorded time. CSV is export-only.</li>
            </ul>

            <h2 className="text-lg font-medium text-zinc-100 mb-3">How It Works</h2>
            <p className="text-zinc-400 text-sm mb-4 leading-relaxed">
                Enter an origin and destination to calculate a route with the{' '}
                <a
                    href="https://developers.google.com/maps/documentation/routes"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-400 underline decoration-violet-400/30 hover:decoration-violet-400"
                >
                    Google Routes API
                </a>
                , or import an existing GPS file without a Google key. Check the
                map, open the download popup, and select an output format.
                Formats with timestamp support keep recorded times by default. Optional time generation
                replaces them with estimates and resets to off for each download.
            </p>
            <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                Imports, file conversion, and saved routes stay in your browser.
                Route calculation and optional place-name lookups send locations
                and your key to Google. Map tiles come from CARTO. Optional
                elevation lookup sends sample coordinates to Open Topo Data
                through the site&apos;s proxy.
            </p>
            <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                Current versions: web app 1.1.0 and Python CLI 0.2.0. The CLI
                calculates Google routes and writes GPX files. The five-format
                download popup is available in the web app.
            </p>

            <h2 className="text-lg font-medium text-zinc-100 mb-3">Tech Stack</h2>
            <div className="flex flex-wrap gap-2 mb-8">
                {['JavaScript', 'Leaflet', 'Google Routes API', 'Python', 'GPX', 'KML', 'GeoJSON', 'TCX', 'CSV'].map(t => (
                    <span key={t} className="px-2 py-0.5 text-xs rounded-full bg-zinc-800 text-zinc-400">
                        {t}
                    </span>
                ))}
            </div>
            <ProjectChangelog entries={project.changelog ?? []} />
        </div>
    );
}
