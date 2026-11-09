import { Suspense, lazy } from 'react';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { staticPageMetadata } from '../utils/pageMetadata';
import { startFlightsMap } from '../features/flights/loadFlightsMap';

const FlightsMap = lazy(startFlightsMap);

export default function Flights() {
  usePageMetadata(staticPageMetadata('/projects/flights/map'));

  return (
    <main id="main-content" className="h-full w-full overflow-hidden">
      <Suspense
        fallback={
          <div className="h-full w-full grid place-items-center text-zinc-300 text-sm">
            Loading flight globe...
          </div>
        }
      >
        <FlightsMap />
      </Suspense>
    </main>
  );
}
