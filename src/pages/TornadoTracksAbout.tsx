import { Link } from 'react-router-dom';
import { useDocumentHead } from '../hooks/useDocumentHead';
import { useJsonLd } from '../hooks/useJsonLd';
import { AUTHOR_PERSON, absoluteUrl } from '../utils/siteMetadata';

export default function TornadoTracksAbout() {
    const description =
        'A full-screen historical tornado track map powered by NOAA/NCEI StormEvents data and MapLibre GL.';

    useDocumentHead({
        title: 'Tornado Tracks',
        description,
        ogImage: absoluteUrl('/og/tornado-tracks.svg'),
    });

    useJsonLd({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Tornado Tracks',
        description,
        url: absoluteUrl('/projects/tornado-tracks'),
        applicationCategory: 'WeatherApplication',
        operatingSystem: 'Web',
        author: AUTHOR_PERSON,
    });

    return (
        <div className="max-w-2xl">
            <h1 className="mb-2 text-2xl font-semibold text-zinc-100">Tornado Tracks</h1>
            <p className="mb-6 text-sm text-zinc-400">2026 · React + MapLibre GL</p>

            <p className="mb-6 leading-relaxed text-zinc-300">
                A time-first map for exploring historical United States tornado
                tracks from NOAA/NCEI StormEvents. The first slice focuses on
                track geometry, EF-scale filtering, Midwest and regional presets,
                density mode, annual playback, and track-level details.
            </p>

            <div className="mb-8 flex flex-wrap gap-3">
                <Link
                    to="/projects/tornado-tracks/map"
                    className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500"
                >
                    Open interactive map →
                </Link>
                <a
                    href="https://github.com/robert-bryson/rsmb.tv/tree/main/src/features/tornadoes"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-700"
                >
                    Source on GitHub →
                </a>
                <a
                    href="https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-700"
                >
                    NOAA source data →
                </a>
            </div>

            <div className="mb-8 space-y-6">
                <figure>
                    <img
                        src="/images/tornado-tracks/conus-tracks.webp"
                        alt="Map of 2025 tornado tracks across the continental United States with EF-scale filters and timeline controls"
                        className="rounded-lg border border-zinc-800"
                        width={1440}
                        height={1082}
                        loading="eager"
                    />
                    <figcaption className="mt-2 text-center text-xs text-zinc-400">
                        CONUS overview — 2025 tornado tracks colored by EF scale with timeline brushing, scale filters, and notable-event context
                    </figcaption>
                </figure>
                <figure>
                    <img
                        src="/images/tornado-tracks/st-louis-detail.webp"
                        alt="Map focused on St. Louis with a selected EF3 tornado track detail popup and decade range selected"
                        className="rounded-lg border border-zinc-800"
                        width={1440}
                        height={1080}
                        loading="lazy"
                    />
                    <figcaption className="mt-2 text-center text-xs text-zinc-400">
                        Track detail — selected St. Louis EF3 event with path length, width, casualty totals, and the 2010s range highlighted
                    </figcaption>
                </figure>
                <figure>
                    <img
                        src="/images/tornado-tracks/trends-dashboard.webp"
                        alt="Tornado Trends view showing annual counts, fatality rate, decade comparison, and top states alongside mapped tracks"
                        className="rounded-lg border border-zinc-800"
                        width={1440}
                        height={1079}
                        loading="lazy"
                    />
                    <figcaption className="mt-2 text-center text-xs text-zinc-400">
                        Trends view — annual counts, fatality rate, decade comparison, and top-state summaries next to the active map
                    </figcaption>
                </figure>
            </div>

            <h2 className="mb-3 text-lg font-medium text-zinc-100">Features</h2>
            <ul className="mb-6 list-inside list-disc space-y-1.5 text-sm text-zinc-400">
                <li>MapLibre track map with EF/F-scale color encoding and density mode</li>
                <li>Timeline histogram with range brushing, playback, and era presets</li>
                <li>Filters for EF1+, EF2+, EF3+, Midwest, Plains, and Dixie Alley</li>
                <li>Clickable track detail panel with length, width, casualties, damages, WFO, and source</li>
                <li>NOAA/IEM sync script that scrapes StormEvents, warning, and watch archives</li>
            </ul>

            <h2 className="mb-3 text-lg font-medium text-zinc-100">Data Pipeline</h2>
            <p className="mb-6 text-sm leading-relaxed text-zinc-400">
                The generator reads compressed StormEvents details CSVs, filters
                tornado rows, normalizes legacy F-scale and modern EF-scale
                labels, validates track coordinates, parses Storm Data damage
                shorthand, and emits static GeoJSON plus annual, state,
                warning/watch, and notable-event summaries for <span className="text-zinc-300">data.rsmb.tv/tornadoes</span>.
                Local files under <span className="text-zinc-300">public/data/tornadoes</span> are only a development/backfill artifact.
            </p>

            <h2 className="mb-3 text-lg font-medium text-zinc-100">Next Layers</h2>
            <p className="mb-6 text-sm leading-relaxed text-zinc-400">
                Warning and watch summaries are available in the Trends view; full
                warning polygons, outlook overlays, and DAT survey layers are still
                kept out of the initial map load so broad historical browsing stays quick.
            </p>

            <h2 className="mb-3 text-lg font-medium text-zinc-100">Tech Stack</h2>
            <div className="mb-8 flex flex-wrap gap-2">
                {['React', 'MapLibre GL', 'NOAA/NCEI', 'StormEvents', 'GeoJSON', 'Node.js'].map((tech) => (
                    <span key={tech} className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                        {tech}
                    </span>
                ))}
            </div>
        </div>
    );
}