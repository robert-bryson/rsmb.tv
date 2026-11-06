import { Suspense, lazy } from 'react';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { staticPageMetadata } from '../utils/pageMetadata';
import { preloadCache } from '../data/fetchCache';

const FlightsMap = lazy(() => {
  // Fetch the required data in parallel with the much larger WebGL bundle.
  // The map's hooks share these requests through the existing JSON cache.
  void preloadCache(['flights.geojson', 'visitedAirports.geojson'].map(
    filename => `${import.meta.env.BASE_URL}data/flights/${filename}`,
  ));
  return import('../features/flights/components/FlightsMap').then((m) => ({
    default: m.FlightsMap,
  }));
});

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
