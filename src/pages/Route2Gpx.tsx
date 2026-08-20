import { useDocumentHead } from '../hooks/useDocumentHead';
import { useJsonLd } from '../hooks/useJsonLd';
import { AUTHOR_PERSON, absoluteUrl } from '../utils/siteMetadata';
import { projects } from '../content/projects';
import { ProjectChangelog } from '../components/ProjectChangelog';
import { ProjectScreenshotGallery, type ProjectScreenshot } from '../components/ProjectScreenshotGallery';
import { ProjectPageHeader } from '../components/ProjectPageHeader';

const ROUTE2GPX_URL = 'https://route2gpx.rsmb.tv';

const screenshots: ProjectScreenshot[] = [
    {
        src: '/images/route2gpx/route-planning.webp',
        alt: 'Route to GPX interface showing origin and destination inputs, waypoints, and route mode options',
        caption: 'Route planning interface - enter origin, destination, waypoints, and travel mode',
        width: 1811,
        height: 1390,
        loading: 'eager',
    },
    {
        src: '/images/route2gpx/single-route.webp',
        alt: 'Single driving route from Mexico City to Teotihuacan displayed on a Leaflet map with Fog of World overlay',
        caption: 'Single route view - driving route with Fog of World overlay and GPX download',
        width: 1818,
        height: 1392,
    },
    {
        src: '/images/route2gpx/multi-route.webp',
        alt: 'Multiple routes across Mexico shown simultaneously with color-coded paths and a route list panel',
        caption: 'Multi-route view - multiple routes across Mexico with batch download',
        width: 1814,
        height: 1390,
    },
];

export default function Route2Gpx() {
    const description =
        'Convert Google Routes into GPX files for GPS devices and bike computers — a privacy-focused web app that runs entirely in your browser.';

    useDocumentHead({
        title: 'route2gpx',
        description,
        ogImage: absoluteUrl('/og/route2gpx.svg'),
    });

    useJsonLd({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'route2gpx',
        description,
        url: ROUTE2GPX_URL,
        applicationCategory: 'TravelApplication',
        operatingSystem: 'Web',
        author: AUTHOR_PERSON,
    });

    const project = projects.find(p => p.slug === 'route2gpx')!;

    return (
        <div className="max-w-[52rem]">
            <ProjectPageHeader
                title="route2gpx"
                stack="JavaScript + Leaflet"
                description={(
                    <>
                        Convert{' '}
                        <a
                            href="https://developers.google.com/maps/documentation/routes"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-violet-400 underline decoration-violet-400/30 hover:decoration-violet-400"
                        >
                            Google Routes
                        </a>{' '}
                        into GPX files for GPS devices and bike computers. A
                        privacy-focused web app that runs entirely in your browser -
                        your routes never touch a server.
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
            <ProjectChangelog entries={project.changelog ?? []} />
        </div>
    );
}
