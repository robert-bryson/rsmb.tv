import { FlightsMap } from '../features/flights';
import { useDocumentHead } from '../hooks/useDocumentHead';

export default function Flights() {
  useDocumentHead({
    title: 'Flight Tracker',
    description: 'Interactive 3D globe visualization of flights around the world. Filter by year, see route frequencies, and explore travel statistics.',
    ogImage: 'https://rsmb.tv/og/flights.svg',
  });

  return (
    <section className="h-full w-full overflow-hidden">
      <FlightsMap />
    </section>
  );
}
