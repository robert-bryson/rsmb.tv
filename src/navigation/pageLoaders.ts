import { moduleLoader } from './moduleLoader';

// Explicit imports retain Vite's chunk/CSS handling and keep feature code out of the entry.
export const pageLoaders = {
    '/about': moduleLoader(() => import('../pages/About').then(m => ({ default: m.About }))),
    '/projects': moduleLoader(() => import('../pages/Projects').then(m => ({ default: m.Projects }))),
    '/posts': moduleLoader(() => import('../pages/Posts').then(m => ({ default: m.Posts }))),
    article: moduleLoader(() => import('../pages/BlogPost').then(m => ({ default: m.BlogPost }))),
    notFound: moduleLoader(() => import('../pages/NotFound').then(m => ({ default: m.NotFound }))),
    '/projects/through-routes': moduleLoader(() => import('../pages/ThroughRoutes')),
    '/projects/flights': moduleLoader(() => import('../pages/FlightsAbout')),
    '/projects/flights/map': moduleLoader(() => import('../pages/Flights')),
    '/projects/anki-artisan': moduleLoader(() => import('../pages/AnkiArtisan')),
    '/projects/bookend': moduleLoader(() => import('../pages/Bookend')),
    '/projects/temperature-records': moduleLoader(() => import('../pages/TemperatureRecordsAbout')),
    '/projects/temperature-records/map': moduleLoader(() => import('../pages/TemperatureRecords')),
    '/projects/temperature-records/trends': moduleLoader(() => import('../pages/ClimateTrends')),
    '/projects/tornado-tracks': moduleLoader(() => import('../pages/TornadoTracksAbout')),
    '/projects/tornado-tracks/map': moduleLoader(() => import('../pages/TornadoTracks')),
    '/projects/route2gpx': moduleLoader(() => import('../pages/Route2Gpx')),
    '/projects/aborg': moduleLoader(() => import('../pages/Aborg')),
    '/projects/parc': moduleLoader(() => import('../pages/Parc')),
    '/projects/status-dashboard': moduleLoader(() => import('../pages/StatusDashboard')),
    '/projects/adv-atlas/map': moduleLoader(() => import('../pages/AdvAtlas')),
    '/projects/pins-of-inaccessibility': moduleLoader(() => import('../pages/PinsOfInaccessibilityAbout')),
    '/projects/pins-of-inaccessibility/map': moduleLoader(() => import('../pages/PinsOfInaccessibility')),
};

export type PageLoaderKey = keyof typeof pageLoaders;
