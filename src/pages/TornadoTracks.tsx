import { Suspense, lazy } from 'react';
import { useDocumentHead } from '../hooks/useDocumentHead';

const TornadoMap = lazy(() =>
    import('../features/tornadoes/components/TornadoMap').then((m) => ({
        default: m.TornadoMap,
    })),
);

export default function TornadoTracks() {
    useDocumentHead({
        title: 'Tornado Tracks',
        description: 'Interactive MapLibre archive of NOAA/NCEI tornado tracks with timeline, EF-scale filters, regional presets, and density mode.',
        ogImage: 'https://rsmb.tv/og/tornado-tracks.svg',
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