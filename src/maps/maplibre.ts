import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

// Resolve the worker through Vite for both direct visits and client navigation.
setWorkerUrl(workerUrl);

export * from 'maplibre-gl';
