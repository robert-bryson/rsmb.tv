import { skiDayStatusText, type ResortReport, type ResortStatus } from './conditions';
import { statusMarkers } from './mapAppearance';

export function SkiStatusLabel({ status, report, now }: { status: ResortStatus; report?: ResortReport; now: number }) {
    const { glyph, color } = statusMarkers[status];
    return <span className="inline-flex items-center gap-1.5 font-medium" style={{ color }}>
        <span aria-hidden="true" className="w-3 text-center">{glyph}</span>{skiDayStatusText(status, report, now)}
    </span>;
}
