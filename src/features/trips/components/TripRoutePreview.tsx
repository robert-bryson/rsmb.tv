import { useEffect, useRef, useState } from 'react';
import { useTripStory } from '../TripStoryContext';
import { useTripRoute } from '../useTripRoute';
import { routeCoordinates, routeFeatures, trackRoute } from '../routeGeometry';

export function TripRoutePreview({ stopId, trackId, onExplore }: { stopId?: string; trackId?: string; onExplore?: () => void }) {
    const { manifest } = useTripStory();
    const ref = useRef<HTMLElement>(null);
    const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined');
    useEffect(() => {
        if (!ref.current || typeof IntersectionObserver === 'undefined') return;
        const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setNear(true); observer.disconnect(); } }, { rootMargin: '300px' });
        observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);
    const { route, error, retry } = useTripRoute(manifest.route.geoJson, near);
    const focused = route && trackId ? trackRoute(route, trackId) : route;
    const coordinates = focused ? routeCoordinates(focused) : [];
    const [minX, maxX, minY, maxY] = coordinates.reduce((bounds, [x,y]) => [Math.min(bounds[0], x), Math.max(bounds[1], x), Math.min(bounds[2], y), Math.max(bounds[3], y)], [Infinity, -Infinity, Infinity, -Infinity]);
    const centerLat = (minY + maxY) / 2;
    const xScale = Math.cos(centerLat * Math.PI / 180);
    const scale = Math.min(700 / ((maxX - minX) * xScale || 1), 300 / (maxY - minY || 1));
    const project = ([x, y]: number[]) => [400 + (x - (minX + maxX) / 2) * xScale * scale, 180 - (y - centerLat) * scale];
    const lines = focused ? routeFeatures(focused).flatMap(feature => feature.geometry.type === 'LineString' ? [feature.geometry.coordinates] : feature.geometry.coordinates) : [];
    return <figure ref={ref} className="trip-breakout my-8 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
        <p className="mb-3 text-sm font-medium text-zinc-200">{manifest.route.tracks?.find(track => track.id === trackId)?.name ?? 'Route overview'}</p>
        {coordinates.length > 0 ? <svg viewBox="0 0 800 360" role="img" aria-label={manifest.route.alt ?? 'Trip route overview'} className="max-h-80 w-full">
            {lines.map((line, index) => <polyline key={index} points={line.map(point => project(point).join(',')).join(' ')} fill="none" stroke="#fbbf24" strokeWidth="3" strokeLinejoin="round" />)}
            {manifest.stops.filter(stop => stop.coordinates[0] >= minX && stop.coordinates[0] <= maxX && stop.coordinates[1] >= minY && stop.coordinates[1] <= maxY).map(stop => { const [x,y] = project(stop.coordinates); return <circle key={stop.id} cx={x} cy={y} r={stop.id === stopId ? 7 : 4} fill="#fafafa"><title>{stop.name}</title></circle>; })}
        </svg> : manifest.route.staticImage ? <img src={manifest.route.staticImage} alt={manifest.route.alt ?? 'Trip route overview'} loading="lazy" className="max-h-80 w-full object-contain" /> : <p className="py-8 text-sm text-zinc-400" role="status">{error || 'Route preview loads as you approach.'}</p>}
        <ol className="my-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-300">{manifest.stops.map((stop, index) => <li key={stop.id}>{index + 1}. {stop.name}{index === 0 ? ' (start)' : index === manifest.stops.length - 1 ? ' (finish)' : ''}</li>)}</ol>
        <div className="flex flex-wrap items-center gap-4 text-sm">
            {onExplore && <button type="button" className="min-h-11 rounded-md bg-violet-600 px-4 text-white hover:bg-violet-500" onClick={onExplore}>Explore interactive map</button>}
            {error && <button type="button" onClick={retry} className="min-h-11 text-violet-300">Retry route preview</button>}
            <a className="inline-flex min-h-11 items-center text-violet-300 underline" href={manifest.route.geoJson} target="_blank" rel="noreferrer">Download route (GeoJSON)</a>
        </div>
    </figure>;
}
