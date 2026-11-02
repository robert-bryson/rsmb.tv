import { Fragment, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getCountryName } from '../../../content/blogRegions';
import { atlasLocations } from './tripAtlasBrowser';
import type { TripAtlasEntry } from './tripAtlasEntries';
import type { AtlasLocation } from './tripAtlasGeography';

export function TripAtlasLocations({ entry, onExplore }: { entry: TripAtlasEntry; onExplore: (location: AtlasLocation) => void }) {
    const items = useMemo(() => atlasLocations(entry).flatMap(country => [
        { country: country.code, label: getCountryName(country.code), region: undefined as string | undefined },
        ...country.regions.map(region => ({ country: country.code, label: region, region })),
    ]), [entry]);
    const [expanded, setExpanded] = useState(false);
    const [visibleCount, setVisibleCount] = useState(items.length);
    const measurement = useRef<HTMLDivElement>(null);
    const listId = useId();
    useLayoutEffect(() => {
        const element = measurement.current;
        if (!element) return;
        const measure = () => {
            const bounds = element.getBoundingClientRect();
            if (!bounds.width) return;
            const bottom = bounds.top + 48;
            const count = [...element.querySelectorAll<HTMLElement>('[data-location]')]
                .findIndex(item => item.getBoundingClientRect().bottom > bottom + 0.5);
            setVisibleCount(count < 0 ? items.length : Math.max(1, count));
        };
        measure();
        const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
        observer?.observe(element);
        return () => observer?.disconnect();
    }, [items]);
    if (!items.length) return <p className="mt-2 text-xs text-zinc-400">Location not recorded</p>;
    return <div className="atlas-locations relative mt-2 text-xs text-zinc-400">
        <div ref={measurement} aria-hidden="true" className="pointer-events-none invisible absolute inset-x-0 top-0">
            {items.map((item, index) => <Fragment key={`${item.country}/${item.region ?? ''}`}>
                {index > 0 && <span> · </span>}
                <span data-location className={`atlas-location-link ${item.region ? '' : 'font-bold'}`}>{item.label}</span>
            </Fragment>)}
        </div>
        <div id={listId}>
            {items.slice(0, expanded ? items.length : visibleCount).map((item, index) => <Fragment key={`${item.country}/${item.region ?? ''}`}>
                {index > 0 && <span aria-hidden="true"> · </span>}
                {item.country || item.region ? <button type="button"
                    aria-label={`Explore ${item.label}${item.region && item.country ? `, ${getCountryName(item.country)}` : ''}`}
                    onClick={() => onExplore({ country: item.country, region: item.region })}
                    className={`atlas-location-link rounded-sm hover:bg-violet-400/15 hover:text-violet-200 focus-visible:outline-2 focus-visible:outline-violet-400 ${item.region ? '' : 'font-bold text-zinc-300'}`}>
                    {item.label}
                </button> : <strong className="atlas-location-link">{item.label}</strong>}
            </Fragment>)}
        </div>
        {visibleCount < items.length && <button type="button" aria-expanded={expanded} aria-controls={listId}
            onClick={() => setExpanded(value => !value)} className="min-h-8 rounded-sm text-violet-300 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-violet-400">
            {expanded ? 'See less' : 'See all'}
        </button>}
    </div>;
}
