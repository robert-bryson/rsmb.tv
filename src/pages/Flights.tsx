import { Suspense, lazy } from 'react';
import { useDocumentHead } from '../hooks/useDocumentHead';

const FlightsMap = lazy(() =>
  import('../features/flights/components/FlightsMap').then((m) => ({
    default: m.FlightsMap,
  })),
);

export default function Flights() {
  useDocumentHead({
    title: 'Flights',
    description: 'Interactive 3D globe visualization of flights around the world. Filter by year, see route frequencies, and explore travel statistics.',
    ogImage: 'https://rsmb.tv/og/flights.svg',
  });

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
