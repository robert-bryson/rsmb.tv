import { ClimateTrends } from '../features/temperatures';
import { useDocumentHead } from '../hooks/useDocumentHead';

export default function ClimateTrendsPage() {
    useDocumentHead({
        title: 'Climate Trends — US Temperature Records',
        description: 'Are temperature records being broken more frequently? Visualizations of record high vs low frequency, age distribution, and geographic patterns.',
    });

    return (
        <section className="h-full w-full overflow-hidden">
            <ClimateTrends />
        </section>
    );
}
