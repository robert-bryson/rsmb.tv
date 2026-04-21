import { Suspense, lazy } from 'react';
import { useDocumentHead } from '../hooks/useDocumentHead';

const ClimateTrends = lazy(() =>
    import('../features/temperatures/components/ClimateTrends').then((m) => ({
        default: m.ClimateTrends,
    })),
);

export default function ClimateTrendsPage() {
    useDocumentHead({
        title: 'Climate Trends — Record Highs',
        description: 'Are temperature records being broken more frequently? Visualizations of record high vs low frequency, age distribution, and geographic patterns.',
        ogImage: 'https://rsmb.tv/og/climate-trends.svg',
    });

    return (
        <section className="h-full w-full overflow-hidden">
            <Suspense
                fallback={
                    <div className="h-full w-full grid place-items-center text-zinc-300 text-sm">
                        Loading climate trends...
                    </div>
                }
            >
                <ClimateTrends />
            </Suspense>
        </section>
    );
}
