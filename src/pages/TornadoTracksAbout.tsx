import { ProjectPageHeader } from '../components/ProjectPageHeader';
import { ProjectScreenshotGallery, type ProjectScreenshot } from '../components/ProjectScreenshotGallery';
import { TechBadges } from '../components/TechBadges';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { staticPageMetadata } from '../utils/pageMetadata';
import { projects } from '../content/projects';
import { ProjectChangelog } from '../components/ProjectChangelog';

const screenshots: ProjectScreenshot[] = [
    {
        src: '/images/tornado-tracks/conus-tracks.webp',
        alt: 'Map of 2025 tornado tracks across the continental United States with EF-scale filters and timeline controls',
        caption: 'CONUS overview — 2025 tornado tracks colored by EF scale with timeline brushing, scale filters, and notable-event context',
        width: 1440,
        height: 1082,
        loading: 'eager',
    },
    {
        src: '/images/tornado-tracks/st-louis-detail.webp',
        alt: 'Map focused on St. Louis with a selected EF3 tornado track detail popup and decade range selected',
        caption: 'Track detail — selected St. Louis EF3 event with path length, width, casualty totals, and the 2010s range highlighted',
        width: 1440,
        height: 1080,
        loading: 'lazy',
    },
    {
        src: '/images/tornado-tracks/trends-dashboard.webp',
        alt: 'Tornado Trends view showing annual counts, fatality rate, decade comparison, and top states alongside mapped tracks',
        caption: 'Trends view — annual counts, fatality rate, decade comparison, and top-state summaries next to the active map',
        width: 1440,
        height: 1079,
        loading: 'lazy',
    },
];

export default function TornadoTracksAbout() {
    usePageMetadata(staticPageMetadata('/projects/tornado-tracks'));

    const project = projects.find(p => p.slug === 'tornado-tracks')!;

    return (
        <div className="max-w-[52rem]">
            <ProjectPageHeader
                title="Tornado Tracks"
                stack="React + MapLibre GL"
                description={(
                    <>
                        A time-first map for exploring historical United States tornado
                        tracks from NOAA/NCEI StormEvents. The first slice focuses on
                        track geometry, EF-scale filtering, Midwest and regional presets,
                        density mode, annual playback, and track-level details.
                    </>
                )}
                actions={[
                    { label: 'Open interactive map →', href: '/projects/tornado-tracks/map', variant: 'primary' },
                    { label: 'Source on GitHub →', href: 'https://github.com/robert-bryson/rsmb.tv/tree/main/src/features/tornadoes', external: true },
                    { label: 'NOAA source data →', href: 'https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/', external: true },
                ]}
            />

            <ProjectScreenshotGallery screenshots={screenshots} />

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

            <h2 className="mb-3 text-lg font-medium text-zinc-100">Reading the data</h2>
            <p className="mb-4 text-sm leading-relaxed text-zinc-400">
                Counts represent recorded county segments with usable coordinates. A tornado crossing a county or state boundary can produce multiple records,
                so these totals are not counts of unique tornadoes. Lines connect reported start and end coordinates;
                they do not trace surveyed damage paths. The U.S. archive includes records outside the initial CONUS viewport. See the{' '}
                <a href="https://www.ncdc.noaa.gov/stormevents/faq.jsp" className="text-sky-400 underline hover:text-sky-300">NOAA StormEvents FAQ</a>.
            </p>
            <p className="mb-6 text-sm leading-relaxed text-zinc-400">
                NOAA reports can arrive several months after an event. Comparisons exclude the current calendar year,
                and changes in observation and reporting affect long-term counts. Warning and watch summaries provide
                national context independent of the map's state and intensity filters; their approximate report matches
                are not formal warning verification.
            </p>

            <h2 className="mb-3 text-lg font-medium text-zinc-100">Next Layers</h2>
            <p className="mb-6 text-sm leading-relaxed text-zinc-400">
                Warning and watch summaries are available in the Trends view; full
                warning polygons, outlook overlays, and DAT survey layers are still
                kept out of the initial map load so broad historical browsing stays quick.
            </p>

            <h2 className="mb-3 text-lg font-medium text-zinc-100">Tech Stack</h2>
            <TechBadges tech={['React', 'MapLibre GL', 'NOAA/NCEI', 'StormEvents', 'GeoJSON', 'Node.js']} className="mb-8" />
            <ProjectChangelog entries={project.changelog ?? []} />
        </div>
    );
}
