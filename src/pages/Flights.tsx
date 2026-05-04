import { Suspense, lazy } from 'react';
import { useDocumentHead } from '../hooks/useDocumentHead';
import { useJsonLd } from '../hooks/useJsonLd';
import { AUTHOR_PERSON, absoluteUrl } from '../utils/siteMetadata';

const FlightsMap = lazy(() =>
  import('../features/flights/components/FlightsMap').then((m) => ({
    default: m.FlightsMap,
  })),
);

const FlightsMap = lazy(() =>
  import('../features/flights/components/FlightsMap').then((m) => ({
    default: m.FlightsMap,
  })),
);

export default function Flights() {
  const description =
    'Interactive 3D globe visualization of flights around the world. Filter by year, see route frequencies, and explore travel statistics.';

  useDocumentHead({
    title: 'Flights',
    description,
    ogImage: 'https://rsmb.tv/og/flights.svg',
  });

  useJsonLd({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Flights Map',
    description,
    url: absoluteUrl('/projects/flights/map'),
    isPartOf: {
      '@type': 'SoftwareApplication',
      name: 'Flights',
      url: absoluteUrl('/projects/flights'),
    },
    author: AUTHOR_PERSON,
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
