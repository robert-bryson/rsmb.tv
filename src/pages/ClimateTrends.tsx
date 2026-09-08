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
        'Explore when today’s standing county temperature extremes were set, including their age distribution and geographic patterns.';

    useDocumentHead({
        title: 'Standing Record Ages — U.S. Temperature Records',
        description,
        ogImage: absoluteUrl('/og/climate-trends.svg'),
    });

    useJsonLd({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Standing Record Ages — U.S. Temperature Records',
        description,
        url: absoluteUrl('/projects/temperature-records/trends'),
        isPartOf: {
            '@type': 'SoftwareApplication',
            name: 'U.S. Temperature Records',
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
                        Loading standing record ages...
                    </div>
                }
            >
                <ClimateTrends />
            </Suspense>
        </section>
    );
}
