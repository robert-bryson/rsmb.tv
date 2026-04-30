import { Suspense, lazy } from 'react';
import { useDocumentHead } from '../hooks/useDocumentHead';
import { useJsonLd } from '../hooks/useJsonLd';
import { AUTHOR_PERSON, absoluteUrl } from '../utils/siteMetadata';

const TornadoMap = lazy(() =>
    import('../features/tornadoes/components/TornadoMap').then((m) => ({
        default: m.TornadoMap,
    })),
);

export default function TornadoTracks() {
    const description =
        'Interactive MapLibre archive of NOAA/NCEI tornado tracks with timeline, EF-scale filters, regional presets, and density mode.';

    useDocumentHead({
        title: 'Tornado Tracks',
        description,
        ogImage: 'https://rsmb.tv/og/tornado-tracks.svg',
    });

    useJsonLd({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Tornado Tracks Map',
        description,
        url: absoluteUrl('/projects/tornado-tracks/map'),
        isPartOf: {
            '@type': 'SoftwareApplication',
            name: 'Tornado Tracks',
            url: absoluteUrl('/projects/tornado-tracks'),
        },
        author: AUTHOR_PERSON,
    });

    return (
        <section className="h-full w-full overflow-hidden">
            <Suspense
                fallback={
                    <div className="grid h-full w-full place-items-center text-sm text-zinc-300">
                        Loading tornado map...
                    </div>
                }
            >
                <TornadoMap />
            </Suspense>
        </section>
    );
}