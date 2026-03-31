import { Link } from 'react-router-dom';
import { useDocumentHead } from '../hooks/useDocumentHead';
import { useJsonLd } from '../hooks/useJsonLd';

export default function TemperatureRecordsAbout() {
    useDocumentHead({
        title: 'Record Highs',
        description:
            'Interactive map of all-time record high and low temperatures across US states and counties, powered by NOAA and ACIS data.',
        ogImage: 'https://rsmb.tv/og/temperature-records.svg',
    });

    useJsonLd({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Record Highs',
        description: 'Interactive map of all-time record high and low temperatures across US states and counties, powered by NOAA and ACIS data.',
        url: 'https://rsmb.tv/projects/temperature-records',
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Web',
        author: { '@type': 'Person', name: 'Robby Bryson', url: 'https://rsmb.tv' },
    });

    return (
        <div className="max-w-2xl">
            <h1 className="text-2xl font-semibold text-zinc-100 mb-2">
                Record Highs
            </h1>
            <p className="text-zinc-500 mb-6 text-sm">
                2025 · React + MapLibre GL
            </p>

            <p className="text-zinc-300 leading-relaxed mb-6">
                An interactive map of all-time record high and low temperatures
                across US states and counties, powered by{' '}
                <a
                    href="https://www.ncei.noaa.gov/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-400 hover:underline"
                >
                    NOAA
                </a>{' '}
                and{' '}
                <a
                    href="https://www.rcc-acis.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-400 hover:underline"
                >
                    ACIS
                </a>{' '}
                data. Includes a summary panel of recent temperature extremes
                and a companion trends analysis.
            </p>

            <div className="flex gap-3 mb-8">
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
                    <figcaption className="mt-2 text-xs text-zinc-500 text-center">
                        Daily records view — 626 record highs and 42 record lows broken in a single day
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
                    <figcaption className="mt-2 text-xs text-zinc-500 text-center">
                        State records view — all-time high and low temperature records for each state
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
                    <figcaption className="mt-2 text-xs text-zinc-500 text-center">
                        Freshness view — county records colored by decade, showing when each record was set
                    </figcaption>
                </figure>
            </div>

            <h2 className="text-lg font-medium text-zinc-100 mb-3">Features</h2>
            <ul className="space-y-1.5 text-zinc-400 text-sm mb-6 list-disc list-inside">
                <li>Choropleth map of record highs and lows at state and county level</li>
                <li>Toggle between all-time record highs and record lows</li>
                <li>Click any state or county to see the record details — temperature, date, and station</li>
                <li>Summary panel showing the most recent records broken across the country</li>
                <li>Companion trends page analyzing whether records are being broken more frequently</li>
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
