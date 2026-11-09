import { Suspense, lazy } from 'react';
import { startTornadoMap } from '../features/tornadoes/loadTornadoMap';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { staticPageMetadata } from '../utils/pageMetadata';

const TornadoMap = lazy(startTornadoMap);

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