import { pageLoaders } from './pageLoaders';
import { getPostBySlug } from '../content/posts';
import type { PrefetchTarget } from './prefetchTargets';
import { settlePreparation } from './moduleLoader';

export async function prepareDestination(target: PrefetchTarget, destination: boolean, heavy: boolean) {
    const tasks: Promise<unknown>[] = [pageLoaders[target.page]()];
    if (destination && target.slug) {
        const post = getPostBySlug(target.slug);
        if (post) {
            tasks.push(post.loadComponent());
            if (post.format === 'trip' && post.tripId) tasks.push(import('../features/trips/tripManifests').then(m => m.loadTripManifest(post.tripId!)));
        }
    }
    if (heavy) {
        switch (target.map) {
            case 'flights': tasks.push(import('../features/flights/loadFlightsMap').then(m => settlePreparation([m.loadFlightsMap(), m.warmFlightData()]))); break;
            case 'temperatures': tasks.push(import('../features/temperatures/loadTemperatureMap').then(m => settlePreparation([m.loadTemperatureMap(), m.warmTemperatureData(target.search)]))); break;
            case 'tornadoes': tasks.push(import('../features/tornadoes/loadTornadoMap').then(m => settlePreparation([m.loadTornadoMap(), m.warmTornadoData()]))); break;
            case 'atlas': tasks.push(import('../features/trips/atlas/loadTripAtlasMap').then(m => m.loadTripAtlasMap())); break;
            case 'pins': tasks.push(import('../features/pins/loadPinsMap').then(m => m.loadPinsMap())); break;
        }
    }
    // Keep the speculative slot until every started branch settles, including after a failure.
    await settlePreparation(tasks);
}
