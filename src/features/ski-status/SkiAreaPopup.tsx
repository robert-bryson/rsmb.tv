import { useEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Popup, type Map } from '../../maps/maplibre';
import { formatSkiLocation } from './browse';
import type { SkiArea } from './catalog';
import type { ResortReport, ResortStatus } from './conditions';
import { SkiStatusLabel } from './SkiStatusLabel';

interface Props {
    area: SkiArea;
    mapRef: RefObject<Map | null>;
    report?: ResortReport;
    status: ResortStatus;
    now: number;
}

export function SkiAreaPopup({ area, mapRef, report, status, now }: Props) {
    const [content] = useState(() => document.createElement('div'));
    const coordinates = area.location.coordinates;

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        const popup = new Popup({
            closeButton: false, closeOnClick: false, focusAfterOpen: false,
            offset: 16, maxWidth: 'min(16rem, calc(100% - 1.5rem))', locationOccludedOpacity: 0,
            className: 'ski-area-popup ski-area-popup-hover',
        }).setLngLat(coordinates).setDOMContent(content).addTo(map);
        return () => { popup.remove(); };
    }, [content, coordinates, mapRef]);

    return createPortal(<div role="tooltip" className="space-y-0.5 text-xs leading-snug">
        <p className="text-sm font-semibold">{area.name}</p>
        <p className="text-slate-300">{formatSkiLocation(area)}</p>
        <SkiStatusLabel status={status} report={report} now={now} />
    </div>, content);
}
