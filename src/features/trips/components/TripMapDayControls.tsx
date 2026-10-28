import { dayColor, tripMapDays } from '../tripMapView';
import type { TripManifest } from '../types';

export function TripMapDayControls({ manifest, dayId, onSelect }: {
    manifest: TripManifest; dayId?: string; onSelect: (dayId?: string) => void;
}) {
    const days = tripMapDays(manifest);
    if (!days.length) return null;
    return <div role="group" aria-label="Map days" className="mb-3 flex flex-wrap gap-2 text-sm">
        <button type="button" aria-pressed={!dayId} className="trip-day-button" onClick={() => onSelect()}>All days</button>
        {days.map((day, index) => <button key={day.id} type="button" aria-pressed={dayId === day.id}
            className="trip-day-button" onClick={() => onSelect(day.id)}>
            <span aria-hidden="true" className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: dayColor(manifest, day.id) }} />
            {index + 1}. {day.title}
        </button>)}
    </div>;
}
