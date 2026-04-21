import { Suspense, lazy } from 'react';
import { useDocumentHead } from '../hooks/useDocumentHead';

const TemperatureMap = lazy(() =>
    import('../features/temperatures/components/TemperatureMap').then((m) => ({
        default: m.TemperatureMap,
    })),
);

export default function TemperatureRecords() {
    useDocumentHead({
        title: 'Record Highs',
        description: 'Interactive map of all-time record high and low temperatures across US states and counties, with recent extremes summary.',
        ogImage: 'https://rsmb.tv/og/temperature-records.svg',
    });

    return (
        <section className="h-full w-full overflow-hidden">
            <Suspense
                fallback={
                    <div className="h-full w-full grid place-items-center text-zinc-300 text-sm">
                        Loading temperature map...
                    </div>
                }
            >
                <TemperatureMap />
            </Suspense>
        </section>
    );
}
