import { Suspense, lazy } from 'react';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { staticPageMetadata } from '../utils/pageMetadata';

const TemperatureMap = lazy(() =>
    import('../features/temperatures/components/TemperatureMap').then((m) => ({
        default: m.TemperatureMap,
    })),
);

export default function TemperatureRecords() {
    usePageMetadata(staticPageMetadata('/projects/temperature-records/map'));

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
