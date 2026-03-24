import { TemperatureMap } from '../features/temperatures';
import { useDocumentHead } from '../hooks/useDocumentHead';

export default function TemperatureRecords() {
    useDocumentHead({
        title: 'US Temperature Records',
        description: 'Interactive map of all-time record high and low temperatures across US states and counties, with recent extremes summary.',
    });

    return (
        <section className="h-full w-full overflow-hidden">
            <TemperatureMap />
        </section>
    );
}
