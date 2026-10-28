import { useEffect, useRef, useState } from 'react';
import { useTripStory } from '../TripStoryContext';
import { useTripRoute } from '../useTripRoute';
import { routeFeatures } from '../routeGeometry';
import { dayColor, trackColor, tripMapCoordinates, tripMapDays, tripMapView, type TripMapFocus } from '../tripMapView';
import { TripMapDayControls } from './TripMapDayControls';

type TripRoutePreviewProps = TripMapFocus & {
    showStops?: boolean;
    onExplore?: () => void;
    onDaySelect?: (id?: string) => void;
    allowDaySelection?: boolean;
    mapError?: string;
    onRetry?: () => void;
    routeState?: ReturnType<typeof useTripRoute>;
};

export function TripRoutePreview({
    stopId, trackId, dayId, showStops = true, onExplore, onDaySelect,
    allowDaySelection = false, mapError, onRetry, routeState,
}: TripRoutePreviewProps) {
    const { manifest } = useTripStory();
    const ref = useRef<HTMLElement>(null);
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
    }, []);
    const previewRoute = useTripRoute(manifest.route.geoJson, near && !routeState);
    const { route, error, retry } = routeState ?? previewRoute;
    const view = tripMapView(manifest, route, { dayId, trackId });
    const days = tripMapDays(manifest);
    const displayedRoute = allowDaySelection || trackId ? route : view.focusedRoute;
    const coordinates = tripMapCoordinates(view, showStops);
    const [minX, maxX, minY, maxY] = coordinates.reduce((bounds, [x,y]) => [Math.min(bounds[0], x), Math.max(bounds[1], x), Math.min(bounds[2], y), Math.max(bounds[3], y)], [Infinity, -Infinity, Infinity, -Infinity]);
    const centerLat = (minY + maxY) / 2;
    const xScale = Math.cos(centerLat * Math.PI / 180);
    const scale = Math.min(700 / ((maxX - minX) * xScale || 1), 300 / (maxY - minY || 1));
    const project = ([x, y]: number[]) => [400 + (x - (minX + maxX) / 2) * xScale * scale, 180 - (y - centerLat) * scale];
    const lines = displayedRoute ? routeFeatures(displayedRoute).flatMap(feature => {
        const lines = feature.geometry.type === 'LineString' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
        const context = Boolean(view.trackIds && !view.trackIds.includes(feature.properties?.trackId));
        const color = context ? '#71717a' : trackId ? '#f59e0b' : trackColor(manifest, feature.properties?.trackId);
        return lines.map(line => ({ coordinates: line, color, opacity: context ? (trackId ? 0.55 : 0.25) : 1 }));
    }) : [];
    const status = mapError || view.error || error;
    let graphic;
    if (coordinates.length) {
        graphic = <svg viewBox="0 0 800 360" role="img" aria-label={view.alt} className="absolute inset-0 h-full w-full p-4">
            {lines.map((line, index) => <polyline key={index}
                points={line.coordinates.map(point => project(point).join(',')).join(' ')}
                fill="none" stroke={line.color} opacity={line.opacity} strokeWidth="3" strokeLinejoin="round" />)}
            {showStops && view.stops
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
        {allowDaySelection && onDaySelect && <TripMapDayControls manifest={manifest} dayId={dayId} onSelect={onDaySelect} />}
        {!dayId && !trackId && !allowDaySelection && days.length > 0 && <ol aria-label="Route days" className="mb-3 flex flex-wrap gap-2 text-sm text-zinc-300">
            <li><span className="trip-day-button" data-current>All days</span></li>
            {days.map((day, index) => <li key={day.id}><a href={`#${day.headingId}`} className="trip-day-button">
                <span aria-hidden="true" className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: dayColor(manifest, day.id) }} />{index + 1}. {day.title}
            </a></li>)}
        </ol>}
        {(dayId || trackId) && <p className="mb-3 text-sm font-medium text-zinc-200">{view.title}</p>}
        {status && <p role="status" className="mb-3 text-sm text-zinc-300">{status}</p>}
        <div className="relative aspect-[16/10] min-h-72 w-full overflow-hidden rounded-md border border-zinc-800 bg-zinc-950">
        {graphic}
        <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-x-4 gap-y-1 bg-zinc-950/90 p-3 text-sm">
            {onExplore && <button type="button" className="min-h-11 rounded-md bg-violet-600 px-4 text-white hover:bg-violet-500" onClick={onExplore}>Explore interactive map</button>}
            {onRetry ? <button type="button" onClick={onRetry} className="min-h-11 text-violet-300">Retry route</button>
                : error && <button type="button" onClick={retry} className="min-h-11 text-violet-300">Retry route preview</button>}
            <a className="inline-flex min-h-11 items-center text-violet-300 underline" href={manifest.route.geoJson} target="_blank" rel="noreferrer">Download route (GeoJSON)</a>
        </div>
        </div>
        <figcaption className="mt-3">
            {view.stops.length > 0 && <p className="mb-2 inline-flex min-h-11 items-center text-sm text-zinc-300">{showStops ? 'Stops' : 'Stops hidden'}</p>}
            <ol hidden={!showStops} className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-400">{view.stops.map(stop => <li key={stop.id} className="rounded px-1.5 py-0.5"><span className="inline-flex min-h-11 items-center">{manifest.stops.indexOf(stop) + 1}. {stop.name}{!view.day && (stop === view.stops[0] ? ' · Start' : stop === view.stops.at(-1) ? ' · Finish' : '')}</span></li>)}</ol>
        </figcaption>
    </figure>;
}
