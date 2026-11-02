import { Suspense, lazy } from 'react';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { staticPageMetadata } from '../utils/pageMetadata';

const FlightsMap = lazy(() =>
  import('../features/flights/components/FlightsMap').then((m) => ({
    default: m.FlightsMap,
  })),
);

export default function Flights() {
  usePageMetadata(staticPageMetadata('/projects/flights/map'));

  return (
    <section className="h-full w-full overflow-hidden">
      <Suspense
        fallback={
          <div className="h-full w-full grid place-items-center text-zinc-300 text-sm">
            Loading flight globe...
          </div>
        }
      >
        <FlightsMap />
      </Suspense>
    </section>
  );
}
