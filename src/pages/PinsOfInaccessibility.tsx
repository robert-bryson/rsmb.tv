import { lazy, Suspense } from 'react';
import { loadPinsMap } from '../features/pins/loadPinsMap';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { staticPageMetadata } from '../utils/pageMetadata';
import { MapSkipLink } from '../components/MapSkipLink';

const PinsExplorer = lazy(loadPinsMap);

export default function PinsOfInaccessibility() {
    usePageMetadata(staticPageMetadata('/projects/pins-of-inaccessibility/map'));
    return <main className="h-full w-full overflow-hidden" tabIndex={-1}>
        <MapSkipLink targetId="pins-controls" />
        <Suspense fallback={<div role="status" className="grid h-full place-items-center text-sm text-zinc-300">Loading Pins of Inaccessibility…</div>}>
            <PinsExplorer />
        </Suspense>
    </main>;
}
