import { Suspense, lazy } from 'react';
import { useDocumentHead } from '../hooks/useDocumentHead';
import { useJsonLd } from '../hooks/useJsonLd';
import { AUTHOR_PERSON, absoluteUrl } from '../utils/siteMetadata';

const ClimateTrends = lazy(() =>
    import('../features/temperatures/components/ClimateTrends').then((m) => ({
        default: m.ClimateTrends,
    })),
);

export default function ClimateTrendsPage() {
    const description =
        'Are temperature records being broken more frequently? Visualizations of record high vs low frequency, age distribution, and geographic patterns.';

    useDocumentHead({
        title: 'Climate Trends — Record Highs',
        description,
        ogImage: absoluteUrl('/og/climate-trends.svg'),
    });

    useJsonLd({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Climate Trends — Record Highs',
        description,
        url: absoluteUrl('/projects/temperature-records/trends'),
        isPartOf: {
            '@type': 'SoftwareApplication',
            name: 'Record Highs',
            url: absoluteUrl('/projects/temperature-records'),
        },
        about: { '@type': 'Thing', name: 'Temperature records' },
        author: AUTHOR_PERSON,
    });

    return (
        <section className="h-full w-full overflow-hidden">
            <Suspense
                fallback={
                    <div className="h-full w-full grid place-items-center text-zinc-300 text-sm">
                        Loading climate trends...
                    </div>
                }
            >
                <ClimateTrends />
            </Suspense>
        </section>
    );
}
