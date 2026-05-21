import { Link } from 'react-router-dom';
import { useDocumentHead } from '../hooks/useDocumentHead';
import { useJsonLd } from '../hooks/useJsonLd';
import { AUTHOR_PERSON, absoluteUrl } from '../utils/siteMetadata';

export default function TemperatureRecordsAbout() {
    const description =
        'Interactive map of all-time record high and low temperatures across US states and counties, powered by NOAA and ACIS data.';

    useDocumentHead({
        title: 'Record Highs',
        description,
        ogImage: absoluteUrl('/og/temperature-records.svg'),
    });

    useJsonLd({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Record Highs',
        description,
        url: absoluteUrl('/projects/temperature-records'),
        applicationCategory: 'WeatherApplication',
        operatingSystem: 'Web',
        author: AUTHOR_PERSON,
    });

    return (
        <div className="max-w-2xl">
            <h1 className="text-2xl font-semibold text-zinc-100 mb-2">
                Record Highs
            </h1>
            <p className="text-zinc-400 mb-6 text-sm">
                2025 · React + MapLibre GL
            </p>

            <p className="text-zinc-300 leading-relaxed mb-6">
                An interactive map of all-time record high and low temperatures
                across US states and counties, powered by{' '}
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
                data. The map separates recent daily/monthly station records
                from county and state all-time records, with a companion trends
                analysis focused on county all-time records.
            </p>

            <div className="mb-8 flex flex-wrap gap-3">
                <Link
                    to="/projects/temperature-records/map?view=freshness"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
                >
                    Open interactive map →
                </Link>
                <Link
                    to="/projects/temperature-records/trends"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium transition-colors"
                >
                    View climate trends →
                </Link>
                <a
                    href="https://github.com/robert-bryson/rsmb.tv/tree/main/src/features/temperatures"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-700"
                >
                    Source on GitHub →
                </a>
            </div>

            <div className="space-y-6 mb-8">
                <figure>
                    <img
                        src="/images/temperature-records/records-daily.webp"
                        alt="Map showing 626 record highs and 42 record lows broken yesterday across the US"
                        className="rounded-lg border border-zinc-800"
                        width={1633}
                        height={973}
                        loading="eager"
                    />
                    <figcaption className="mt-2 text-xs text-zinc-400 text-center">
                        Recent view — daily/monthly station records broken in a single day
                    </figcaption>
                </figure>
                <figure>
                    <img
                        src="/images/temperature-records/state-records.webp"
                        alt="Map of all-time state temperature records across the US with record highs and lows"
                        className="rounded-lg border border-zinc-800"
                        width={1624}
                        height={967}
                        loading="lazy"
                    />
                    <figcaption className="mt-2 text-xs text-zinc-400 text-center">
                        State All-Time view — highest high and lowest low temperature records for each state
                    </figcaption>
                </figure>
                <figure>
                    <img
                        src="/images/temperature-records/freshness-county.webp"
                        alt="County records colored by decade showing when each record was set"
                        className="rounded-lg border border-zinc-800"
                        width={1628}
                        height={968}
                        loading="lazy"
                    />
                    <figcaption className="mt-2 text-xs text-zinc-400 text-center">
                        Record Age view — county all-time records colored by the decade each standing record was set
                    </figcaption>
                </figure>
            </div>

            <h2 className="text-lg font-medium text-zinc-100 mb-3">Features</h2>
            <ul className="space-y-1.5 text-zinc-400 text-sm mb-6 list-disc list-inside">
                <li>Map layers for recent station records, county all-time records, and state all-time records</li>
                <li>High/low tabs that keep the side panel and map symbology synchronized</li>
                <li>Click any state or county to see the record details — temperature, date, and station</li>
                <li>Summary panel showing recent daily/monthly station records broken across the country</li>
                <li>Companion trends page analyzing whether county all-time records skew increasingly hot</li>
            </ul>

            <h2 className="text-lg font-medium text-zinc-100 mb-3">Data</h2>
            <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                Temperature records are sourced from NOAA's Applied Climate
                Information System (ACIS). The data pipeline fetches state and
                county-level records, processes them into GeoJSON and JSON
                summaries, and syncs the results to S3 for the frontend to
                consume.
            </p>

            <h2 className="text-lg font-medium text-zinc-100 mb-3">Tech Stack</h2>
            <div className="flex flex-wrap gap-2 mb-8">
                {['React', 'MapLibre GL', 'NOAA ACIS', 'GeoJSON', 'AWS S3', 'Terraform'].map(
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
        </div>
    );
}
