import { ClimateTrends } from '../features/temperatures';
import { useDocumentHead } from '../hooks/useDocumentHead';

export default function ClimateTrendsPage() {
    useDocumentHead({
        title: 'Climate Trends — Record Highs',
        description: 'Are temperature records being broken more frequently? Visualizations of record high vs low frequency, age distribution, and geographic patterns.',
        ogImage: 'https://rsmb.tv/og/climate-trends.svg',
    });

    return (
        <section className="h-full w-full overflow-hidden">
            <ClimateTrends />
        </section>
    );
}
