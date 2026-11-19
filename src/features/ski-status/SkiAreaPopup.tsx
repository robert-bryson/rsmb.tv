import { useEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Popup, type Map } from '../../maps/maplibre';
import { columns, formatSkiLocation, formatSkiStat, type SkiUnits } from './browse';
import type { SkiArea } from './catalog';

type Props = { area: SkiArea; mapRef: RefObject<Map | null> } & (
    { onClose?: undefined; units?: undefined } | { onClose: () => void; units: SkiUnits }
);

const summaryColumns = columns.filter(({ key }) => key === 'acres' || key === 'verticalFt' || key === 'liftCount');

export function SkiAreaPopup({ area, mapRef, onClose, units }: Props) {
    const [content] = useState(() => document.createElement('div'));
    const coordinates = area.location.coordinates;
    const selected = Boolean(onClose);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        const popup = new Popup({
            closeButton: false, closeOnClick: false, focusAfterOpen: false,
            offset: 16, maxWidth: 'min(16rem, calc(100% - 1.5rem))',
            className: selected ? 'ski-area-popup ski-area-popup-selected' : 'ski-area-popup ski-area-popup-hover',
        }).setLngLat(coordinates).setDOMContent(content).addTo(map);
        return () => { popup.remove(); };
    }, [content, coordinates, mapRef, selected]);

    const stats = units ? summaryColumns.flatMap(({ key, label }) => {
        const value = formatSkiStat(area, key, units);
        return value === undefined ? [] : [{ label, value }];
    }) : [];

    return createPortal(
        <div role={selected ? 'region' : 'tooltip'} aria-label={selected ? `${area.name} map popup` : undefined} className="relative text-xs leading-snug">
            <div className={selected ? 'pr-8' : undefined}>
                <p className="text-sm font-semibold">{area.name}</p>
                <p className="mt-0.5 text-zinc-300">{formatSkiLocation(area)}</p>
            </div>
            {onClose && <button type="button" onClick={onClose} aria-label="Close resort popup"
                className="absolute -top-2 -right-2 grid size-11 place-items-center rounded-md text-xl text-zinc-300 hover:text-white">
                <span aria-hidden="true">×</span>
            </button>}
            {stats.length > 0 && <dl className="mt-2 flex flex-wrap gap-x-3 gap-y-2 border-t border-zinc-700 pt-2">
                {stats.map(({ label, value }) => <div key={label}>
                    <dt className="text-zinc-400">{label}</dt>
                    <dd className="mt-0.5 font-medium tabular-nums">{value}</dd>
                </div>)}
            </dl>}
            {selected && <a href="#ski-area-details" className="mt-1 inline-flex min-h-10 items-center underline underline-offset-4 text-cyan-300 hover:text-cyan-100">
                View resort details
            </a>}
        </div>, content,
    );
}
