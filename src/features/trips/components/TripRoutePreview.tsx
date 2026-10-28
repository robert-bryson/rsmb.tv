import { useEffect, useId, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { useTripStory } from '../TripStoryContext';
import { useTripRoute } from '../useTripRoute';
import { routeFeatures } from '../routeGeometry';
import { dayColor, routeBackgroundStyle, routeContextColor, trackColor, tripMapCoordinates, tripMapDayForTrack, tripMapDays, tripMapView, type TripMapFocus } from '../tripMapView';
import { TripMapDayControls } from './TripMapDayControls';
import { useTripMapDismiss } from '../useTripMapDismiss';
import { useTripMapHighlight } from '../useTripMapHighlight';

type TripRoutePreviewProps = TripMapFocus & {
    showStops?: boolean;
    onExplore?: () => void;
    onDaySelect?: (id?: string) => void;
    allowDaySelection?: boolean;
    mapError?: string;
    onRetry?: () => void;
    routeState?: ReturnType<typeof useTripRoute>;
    figureRef?: RefObject<HTMLElement | null>;
};

export function TripRoutePreview({
    stopId, trackId, dayId, showStops = true, onExplore, onDaySelect,
    allowDaySelection = false, mapError, onRetry, routeState, figureRef,
}: TripRoutePreviewProps) {
    const { manifest } = useTripStory();
    const ownRef = useRef<HTMLElement>(null);
    const ref = figureRef ?? ownRef;
    const routeUrl = manifest.route.geoJson;
    const [selection, setSelection] = useState<{ routeUrl: string; id?: string }>({ routeUrl });
    if (selection.routeUrl !== routeUrl) setSelection({ routeUrl });
    const selectedDayId = onDaySelect ? dayId : dayId ?? selection.id;
    const highlight = useTripMapHighlight(routeUrl);
    const tooltipId = useId();
    const emphasizedDayId = highlight.id ?? selectedDayId;
    const isBaseMap = allowDaySelection || (!dayId && !trackId && !stopId);
    const isOverview = isBaseMap && tripMapDays(manifest).length > 0;
    const stopsVisible = !isBaseMap && showStops;
    const selectDay = (id?: string) => {
        if (onDaySelect) onDaySelect(id);
        else setSelection({ routeUrl, id });
    };
    // A parent owns selection dismissal, but this renderer always owns its tooltip.
    useTripMapDismiss(ref, isOverview && Boolean(highlight.id || !figureRef && selectedDayId), ({ resetSelection }) => {
        highlight.dismiss();
        if (resetSelection && selectedDayId && !figureRef) selectDay();
    });
    const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined');
    useEffect(() => {
        if (!ref.current || typeof IntersectionObserver === 'undefined') return;
        const observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting)) {
                setNear(true);
                observer.disconnect();
            }
        }, { rootMargin: '300px' });
        observer.observe(ref.current);
        return () => observer.disconnect();
    }, [ref]);
    const previewRoute = useTripRoute(manifest.route.geoJson, near && !routeState);
    const { route, error, retry } = routeState ?? previewRoute;
    const view = tripMapView(manifest, route, { dayId: selectedDayId, trackId });
    const coordinates = tripMapCoordinates(view, stopsVisible);
    const [minX, maxX, minY, maxY] = coordinates.reduce((bounds, [x,y]) => [Math.min(bounds[0], x), Math.max(bounds[1], x), Math.min(bounds[2], y), Math.max(bounds[3], y)], [Infinity, -Infinity, Infinity, -Infinity]);
    const centerLat = (minY + maxY) / 2;
    const xScale = Math.cos(centerLat * Math.PI / 180);
    const scale = Math.min(700 / ((maxX - minX) * xScale || 1), 300 / (maxY - minY || 1));
    const project = ([x, y]: number[]) => [400 + (x - (minX + maxX) / 2) * xScale * scale, 180 - (y - centerLat) * scale];
    const inlineDay = Boolean(dayId && !isOverview);
    const contextStyle = inlineDay || isOverview ? routeBackgroundStyle : { color: routeContextColor, width: 3, opacity: 0.55 };
    const lines = route ? routeFeatures(route).flatMap((feature, featureIndex) => {
        const lines = feature.geometry.type === 'LineString' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
        const tracks = isOverview && emphasizedDayId
            ? manifest.days?.find(day => day.id === emphasizedDayId)?.trackIds : view.trackIds;
        const context = Boolean(tracks && !tracks.includes(feature.properties?.trackId));
        const color = context ? contextStyle.color : trackId ? '#f59e0b' : trackColor(manifest, feature.properties?.trackId);
        const day = tripMapDayForTrack(manifest, feature.properties?.trackId);
        return lines.map((line, lineIndex) => ({ key: `${featureIndex}-${lineIndex}`, coordinates: line, dayId: day?.id, context, color, opacity: context ? contextStyle.opacity : 1,
            width: context ? contextStyle.width : inlineDay || isOverview && emphasizedDayId ? 6 : 3 }));
    }).sort((left, right) => Number(right.context) - Number(left.context)) : [];
    const status = mapError || view.error || error;
    const popupDay = isOverview && coordinates.length ? manifest.days?.find(day => day.id === highlight.id) : undefined;
    let graphic;
    if (coordinates.length) {
        graphic = <svg viewBox="0 0 800 360" role="img" aria-label={view.alt} className="absolute inset-0 h-full w-full p-4"
            onClick={isOverview && selectedDayId ? () => selectDay() : undefined}>
            {lines.map(line => <polyline key={line.key}
                points={line.coordinates.map(point => project(point).join(',')).join(' ')}
                fill="none" stroke={line.color} opacity={line.opacity} strokeWidth={line.width} strokeLinejoin="round"
                onClick={isOverview && line.dayId ? event => {
                    event.stopPropagation();
                    selectDay(selectedDayId === line.dayId ? undefined : line.dayId);
                } : undefined}
                onMouseEnter={isOverview && line.dayId ? () => highlight.onHover(line.dayId) : undefined}
                onMouseLeave={isOverview ? () => highlight.onHover(undefined) : undefined}
                style={isOverview && line.dayId ? { cursor: 'pointer' } : undefined} />)}
            {stopsVisible && view.stops
                .filter(stop => stop.coordinates[0] >= minX && stop.coordinates[0] <= maxX
                    && stop.coordinates[1] >= minY && stop.coordinates[1] <= maxY)
                .map(stop => {
                    const [x, y] = project(stop.coordinates);
                    return <circle key={stop.id} cx={x} cy={y} r={stop.id === stopId ? 7 : 4} fill="#fafafa">
                        <title>{stop.name}</title>
                    </circle>;
                })}
        </svg>;
    } else if (manifest.route.staticImage && !dayId && !trackId) {
        graphic = <img src={manifest.route.staticImage} alt={view.alt} loading="lazy" className="absolute inset-0 h-full w-full object-contain" />;
    } else if (!status) {
        graphic = <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-zinc-400" role="status">
            Route preview loads as you approach.
        </p>;
    }

    return <figure ref={ref} className="trip-breakout my-10">
        {!isOverview && !dayId && trackId && <p className="mb-3 text-sm font-medium text-zinc-200">{view.title}</p>}
        {status && <p role="status" className="mb-3 text-sm text-zinc-300">{status}</p>}
        <div className="relative aspect-[16/10] min-h-72 w-full overflow-hidden rounded-md border border-zinc-800 bg-zinc-950">
        {graphic}
        {popupDay && <div id={tooltipId} role="tooltip" className="trip-day-preview-popup absolute left-1/2 top-4 z-10 max-w-[calc(100%-2rem)] -translate-x-1/2"
            style={{ '--trip-day-color': dayColor(manifest, popupDay.id) } as CSSProperties}>{popupDay.title}</div>}
        <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-x-4 gap-y-1 bg-zinc-950/90 p-3 text-sm">
            {onExplore && <button type="button" className="min-h-11 rounded-md bg-violet-600 px-4 text-white hover:bg-violet-500" onClick={onExplore}>Explore interactive map</button>}
            {onRetry ? <button type="button" onClick={onRetry} className="min-h-11 text-violet-300">Retry route</button>
                : error && <button type="button" onClick={retry} className="min-h-11 text-violet-300">Retry route preview</button>}
            <a className="inline-flex min-h-11 items-center text-violet-300 underline" href={manifest.route.geoJson} target="_blank" rel="noreferrer">Download route (GeoJSON)</a>
        </div>
        </div>
        <figcaption className="mt-3">
            {isBaseMap ? <TripMapDayControls manifest={manifest} dayId={selectedDayId} highlightedDayId={highlight.id} tooltipId={popupDay ? tooltipId : undefined} onSelect={selectDay} onHighlight={highlight.onHover} onFocusDay={highlight.onFocus} />
                : <>
                    {view.stops.length > 0 && <p className="mb-2 inline-flex min-h-11 items-center text-sm text-zinc-300">{showStops ? 'Stops' : 'Stops hidden'}</p>}
                    <ol hidden={!showStops} className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-400">{view.stops.map(stop => <li key={stop.id} className="rounded px-1.5 py-0.5"><span className="inline-flex min-h-11 items-center">{manifest.stops.indexOf(stop) + 1}. {stop.name}{!view.day && (stop === view.stops[0] ? ' · Start' : stop === view.stops.at(-1) ? ' · Finish' : '')}</span></li>)}</ol>
                </>}
        </figcaption>
    </figure>;
}
