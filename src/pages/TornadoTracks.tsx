import { Suspense, lazy } from 'react';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { staticPageMetadata } from '../utils/pageMetadata';

const TornadoMap = lazy(() =>
    import('../features/tornadoes/components/TornadoMap').then((m) => ({
        default: m.TornadoMap,
    })),
);

export default function TornadoTracks() {
    usePageMetadata(staticPageMetadata('/projects/tornado-tracks/map'));

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