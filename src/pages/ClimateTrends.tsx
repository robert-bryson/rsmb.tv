import { Suspense, lazy } from 'react';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { staticPageMetadata } from '../utils/pageMetadata';

const ClimateTrends = lazy(() =>
    import('../features/temperatures/components/ClimateTrends').then((m) => ({
        default: m.ClimateTrends,
    })),
);

export default function ClimateTrendsPage() {
    usePageMetadata(staticPageMetadata('/projects/temperature-records/trends'));

    return (
        <section className="h-full w-full overflow-hidden">
            <Suspense
                fallback={
                    <div className="h-full w-full grid place-items-center text-zinc-300 text-sm">
                        Loading standing record ages...
                    </div>
                }
            >
                <ClimateTrends />
            </Suspense>
        </section>
    );
}
