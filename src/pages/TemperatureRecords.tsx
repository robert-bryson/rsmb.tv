import { Suspense, lazy, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { loadTemperatureMap, warmTemperatureData } from '../features/temperatures/loadTemperatureMap';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { staticPageMetadata } from '../utils/pageMetadata';
import { temperatureDataView } from '../features/temperatures/temperatureDataView';

const TemperatureMap = lazy(loadTemperatureMap);

export default function TemperatureRecords() {
    const view = temperatureDataView(useLocation().search);
    useEffect(() => {
        void warmTemperatureData(`?view=${view}`, 'auto').catch(() => { /* The mounted consumer owns visible errors. */ });
    }, [view]);
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
