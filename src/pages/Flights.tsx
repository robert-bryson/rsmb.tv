import { Suspense, lazy, startTransition, useEffect, useState } from 'react';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { staticPageMetadata } from '../utils/pageMetadata';
import { startFlightsMap } from '../features/flights/loadFlightsMap';

const FlightsMap = lazy(startFlightsMap);

function LoadingFlights() {
  return (
    <div role="status" className="h-full w-full grid place-items-center text-zinc-300 text-sm">
      Loading flight globe...
    </div>
  );
}

export default function Flights() {
  usePageMetadata(staticPageMetadata('/projects/flights/map'));
  const [canMountMap, setCanMountMap] = useState(false);
  useEffect(() => {
    // A prepared renderer can mount during the navigation's first commit.
    // Give loading feedback a paint before its synchronous WebGL startup.
    let frame = requestAnimationFrame(() => {
      // Retain the painted status while lazy loading resolves. A new fallback
      // commit here would add React's minimum fallback reveal delay.
      frame = requestAnimationFrame(() => startTransition(() => setCanMountMap(true)));
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <main id="main-content" className="h-full w-full overflow-hidden">
      <Suspense fallback={<LoadingFlights />}>
        {canMountMap ? <FlightsMap /> : <LoadingFlights />}
      </Suspense>
    </main>
  );
}
