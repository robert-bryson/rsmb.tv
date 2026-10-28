import type { CSSProperties } from 'react';
import { dayColor, tripMapDays } from '../tripMapView';
import type { TripManifest } from '../types';

export function TripMapDayControls({ manifest, dayId, highlightedDayId, tooltipId, onSelect, onHighlight, onFocusDay }: {
    manifest: TripManifest;
    dayId?: string;
    highlightedDayId?: string;
    tooltipId?: string;
    onSelect: (dayId?: string) => void;
    onHighlight?: (dayId?: string) => void;
    onFocusDay?: (dayId?: string) => void;
}) {
    const days = tripMapDays(manifest);
    if (!days.length) return null;
    return <div role="group" aria-label="Map days" className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
        {days.map((day, index) => <button key={day.id} type="button" aria-pressed={dayId === day.id}
            data-highlighted={highlightedDayId === day.id || undefined}
            aria-describedby={highlightedDayId === day.id ? tooltipId : undefined}
            className="trip-day-button" style={{ '--trip-day-color': dayColor(manifest, day.id) } as CSSProperties}
            onMouseEnter={() => onHighlight?.(day.id)} onMouseLeave={() => onHighlight?.()}
            onFocus={() => onFocusDay?.(day.id)} onBlur={() => onFocusDay?.()}
            onClick={() => onSelect(dayId === day.id ? undefined : day.id)}>
            {index + 1}. {day.title}
        </button>)}
    </div>;
}
