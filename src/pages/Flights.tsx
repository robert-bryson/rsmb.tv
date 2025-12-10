import { FlightsMap } from '../features/flights';

export default function Flights() {
  return (
    <section className="h-[calc(100vh-12rem)] w-full rounded-lg overflow-hidden">
      <FlightsMap />
    </section>
  );
}
