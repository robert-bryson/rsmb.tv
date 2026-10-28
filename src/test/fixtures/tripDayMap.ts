import type { RouteGeoJson } from '../../features/trips/routeGeometry';
import type { TripManifest } from '../../features/trips/types';

export const dayMapRoute: RouteGeoJson = {
    type: 'FeatureCollection', features: [
        { type: 'Feature', properties: { trackId: 'morning' }, geometry: { type: 'LineString', coordinates: [[-122, 47], [-123, 46]] } },
        { type: 'Feature', properties: { trackId: 'afternoon' }, geometry: { type: 'MultiLineString', coordinates: [[[-123, 46], [-124, 45]], [[-124, 45], [-124.1, 45]]] } },
        { type: 'Feature', properties: { trackId: 'return' }, geometry: { type: 'LineString', coordinates: [[-124, 45], [-122, 47]] } },
        { type: 'Feature', properties: { trackId: 'unassigned' }, geometry: { type: 'LineString', coordinates: [[-120, 44], [-121, 45]] } },
    ],
};

export const dayMapManifest: TripManifest = {
    id: 'daily-trip', dates: { start: '2024-05-01', end: '2024-05-03' }, hero: 'hero',
    route: { geoJson: '/daily-route.geojson', tracks: [
        { id: 'morning', name: 'Morning ride' }, { id: 'afternoon', name: 'Afternoon ride' },
        { id: 'return', name: 'Return ride' },
    ] },
    photos: [{ id: 'hero', src: '/hero.webp', width: 1600, height: 1000, alt: 'A coast' }],
    stops: [
        { id: 'start', name: 'Harbor', coordinates: [-122, 47] },
        { id: 'camp', name: 'Shared camp', coordinates: [-124.5, 45] },
        { id: 'finish', name: 'Home', coordinates: [-122, 47] },
    ],
    days: [
        { id: 'coastbound', title: 'Coastbound', headingId: 'first-day', trackIds: ['morning', 'afternoon'], stopIds: ['start', 'camp'] },
        { id: 'homebound', title: 'Homebound', headingId: 'second-day', trackIds: ['return'], stopIds: ['camp', 'finish'] },
        { id: 'rest', title: 'Rest day', headingId: 'rest-day' },
    ],
};
