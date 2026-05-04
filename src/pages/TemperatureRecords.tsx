import { Suspense, lazy } from 'react';
import { useDocumentHead } from '../hooks/useDocumentHead';
import { useJsonLd } from '../hooks/useJsonLd';
import { AUTHOR_PERSON, absoluteUrl } from '../utils/siteMetadata';

const TemperatureMap = lazy(() =>
    import('../features/temperatures/components/TemperatureMap').then((m) => ({
        default: m.TemperatureMap,
    })),
);

const TemperatureMap = lazy(() =>
    import('../features/temperatures/components/TemperatureMap').then((m) => ({
        default: m.TemperatureMap,
    })),
);

export default function TemperatureRecords() {
    const description =
        'Interactive map of all-time record high and low temperatures across US states and counties, with recent extremes summary.';

    useDocumentHead({
        title: 'Record Highs',
        description,
        ogImage: 'https://rsmb.tv/og/temperature-records.svg',
    });

    useJsonLd({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Record Highs Map',
        description,
        url: absoluteUrl('/projects/temperature-records/map'),
        isPartOf: {
            '@type': 'SoftwareApplication',
            name: 'Record Highs',
            url: absoluteUrl('/projects/temperature-records'),
        },
        author: AUTHOR_PERSON,
    });

    return (
        <section className="h-full w-full overflow-hidden">
            <Suspense
                fallback={
                    <div className="h-full w-full grid place-items-center text-zinc-300 text-sm">
                        Loading temperature map...
                    </div>
                }
            >
                <TemperatureMap />
            </Suspense>
        </section>
    );
}
