import { useEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Popup, type Map } from '../../maps/maplibre';
import { skiAreaMapPoint, type SkiArea } from './catalog';
import type { ResortReport, ResortStatus } from './conditions';
import { SkiLocation } from './SkiLocation';
import { SkiStatusLabel } from './SkiStatusLabel';

interface Props {
    area: SkiArea;
    mapRef: RefObject<Map | null>;
    report?: ResortReport;
    status: ResortStatus;
    now: number;
    onZoomLocation: (place: string) => void;
    onKeepOpen: () => void;
    onDismiss: () => void;
}

export function SkiAreaPopup({ area, mapRef, report, status, now, onZoomLocation, onKeepOpen, onDismiss }: Props) {
    const [content] = useState(() => document.createElement('div'));
    const coordinates = skiAreaMapPoint(area);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        const popup = new Popup({
            closeButton: false, closeOnClick: false, focusAfterOpen: false,
            offset: 16, maxWidth: 'min(16rem, calc(100% - 1.5rem))', locationOccludedOpacity: 0,
            className: 'ski-area-popup',
        }).setLngLat(coordinates).setDOMContent(content).addTo(map);
        return () => { popup.remove(); };
    }, [content, coordinates, mapRef]);

    return createPortal(<div role="group" aria-label={`${area.name} map preview`} className="space-y-0.5 text-xs leading-snug"
        onPointerEnter={onKeepOpen} onFocus={onKeepOpen}
        onPointerLeave={event => { if (!event.currentTarget.contains(document.activeElement)) onDismiss(); }}
        onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget) && !event.currentTarget.matches(':hover')) onDismiss(); }}>
        <p className="text-sm font-semibold">{area.name}</p>
        <p className="text-slate-300"><SkiLocation area={area} onZoom={onZoomLocation} /></p>
        <SkiStatusLabel status={status} report={report} now={now} />
        {status === 'unknown' && <div className="space-y-1 border-t border-zinc-700 pt-1.5">
            {!report && <p className="text-slate-300">No verified operating report for today.</p>}
            <a href={area.reportUrl ?? area.website} target="_blank" rel="noreferrer"
                className="inline-block text-cyan-200 underline underline-offset-2">
                {area.reportUrl ? 'Check official conditions' : 'Visit resort website'}
            </a>
        </div>}
    </div>, content);
}
