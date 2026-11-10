import { Suspense, lazy } from 'react';
import { startTornadoMap } from '../features/tornadoes/loadTornadoMap';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { staticPageMetadata } from '../utils/pageMetadata';
import { MapSkipLink } from '../components/MapSkipLink';

const TornadoMap = lazy(startTornadoMap);

export default function TornadoTracks() {
    usePageMetadata(staticPageMetadata('/projects/tornado-tracks/map'));

    return (
        <main tabIndex={-1} className="h-full w-full overflow-hidden">
            <h1 className="sr-only">Tornado Tracks</h1>
            <MapSkipLink targetId="tornado-controls" />
            <Suspense
                fallback={
                    <div role="status" className="grid h-full w-full place-items-center text-sm text-zinc-300">
                        Loading tornado map...
                    </div>
                }
            >
                <TornadoMap />
            </Suspense>
        </main>
    );
}
