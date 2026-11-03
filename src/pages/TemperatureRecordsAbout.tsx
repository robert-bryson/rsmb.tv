import { ProjectPageHeader } from '../components/ProjectPageHeader';
import { ProjectScreenshotGallery, type ProjectScreenshot } from '../components/ProjectScreenshotGallery';
import { TechBadges } from '../components/TechBadges';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { staticPageMetadata } from '../utils/pageMetadata';
import { projects } from '../content/projects';
import { ProjectChangelog } from '../components/ProjectChangelog';

const screenshots: ProjectScreenshot[] = [
    {
        src: '/images/temperature-records/records-daily.webp',
        alt: 'Map showing 626 record highs and 42 record lows broken yesterday across the US',
        caption: 'Recent view — daily/monthly station records broken in a single day',
        width: 1633,
        height: 973,
        loading: 'eager',
    },
    {
        src: '/images/temperature-records/state-records.webp',
        alt: 'Map of certified state temperature extremes across the US',
        caption: 'State Extremes view — NOAA-certified highest high and lowest low for each state',
        width: 1624,
        height: 967,
        loading: 'lazy',
    },
    {
        src: '/images/temperature-records/freshness-county.webp',
        alt: 'County records colored by decade showing when each record was set',
        caption: 'Record Age view — county all-time records colored by the decade each standing record was set',
        width: 1628,
        height: 968,
        loading: 'lazy',
    },
];

export default function TemperatureRecordsAbout() {
    usePageMetadata(staticPageMetadata('/projects/temperature-records'));

    const project = projects.find(p => p.slug === 'temperature-records')!;

    return (
        <div className="max-w-[52rem]">
            <ProjectPageHeader
                title="U.S. Temperature Records"
                stack="React + MapLibre GL"
                description={(
                    <>
                        Explore recent station record events, observed county extremes,
                        certified state extremes, and the ages of today&apos;s standing
                        county records, powered by{' '}
                        <a
                            href="https://www.ncei.noaa.gov/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-violet-400 underline decoration-violet-400/30 hover:decoration-violet-400"
                        >
                            NOAA
                        </a>{' '}
                        and{' '}
                        <a
                            href="https://www.rcc-acis.org/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-violet-400 underline decoration-violet-400/30 hover:decoration-violet-400"
                        >
                            ACIS
                        </a>{' '}
                        data. Each view answers a different question and states its scope
                        directly; raw recent-event counts and standing-record ages are not
                        presented as climate-trend estimates.
                    </>
                )}
                actions={[
                    { label: 'Open interactive map →', href: '/projects/temperature-records/map', variant: 'primary' },
                    { label: 'Explore standing record ages →', href: '/projects/temperature-records/trends' },
                    { label: 'Source on GitHub →', href: 'https://github.com/robert-bryson/rsmb.tv/tree/main/src/features/temperatures', external: true },
                ]}
            />

            <ProjectScreenshotGallery screenshots={screenshots} />

            <h2 className="text-lg font-medium text-zinc-100 mb-3">Features</h2>
            <ul className="space-y-1.5 text-zinc-400 text-sm mb-6 list-disc list-inside">
                <li>Map layers for recent station records, county all-time records, and state all-time records</li>
                <li>High/low tabs that keep the side panel and map symbology synchronized</li>
                <li>Click any state or county to see the record details — temperature, date, and station</li>
                <li>Summary panel showing recent daily/monthly station records broken across the country</li>
                <li>Companion record-age page showing when today&apos;s surviving county extremes were set</li>
            </ul>

            <h2 className="text-lg font-medium text-zinc-100 mb-3">Data</h2>
            <div className="text-zinc-400 text-sm mb-6 leading-relaxed space-y-3">
                <p>
                    State extremes come from NOAA&apos;s State Climate Extremes Committee records. County extremes are computed from ACIS station
                    period-of-record observations by selecting the highest maximum and lowest minimum reported in each county. County values are
                    descriptive and are not independently certified state records.
                </p>
                <p>
                    County views cover the 48 contiguous states from 1890 onward. Station histories and data completeness vary, so “all-time”
                    means the available ACIS period of record rather than a uniform observation period. Recent daily and
                    monthly station records use observations beginning in 1950; displayed comparison averages cover 1950 through the year before
                    each observation. The standing-record history groups only records that remain county extremes today, not every record-breaking
                    event that occurred historically. Recent event totals are raw station counts, not normalized trend estimates.
                </p>
            </div>

            <h2 className="text-lg font-medium text-zinc-100 mb-3">Tech Stack</h2>
            <TechBadges tech={['React', 'MapLibre GL', 'NOAA ACIS', 'GeoJSON', 'AWS S3', 'Terraform']} className="mb-8" />
            <ProjectChangelog entries={project.changelog ?? []} />
        </div>
    );
}
