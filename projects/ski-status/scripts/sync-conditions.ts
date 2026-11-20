import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { skiAreas } from '../../../src/features/ski-status/catalog.ts';
import { digest, publishConditions } from './conditions-publication.ts';
import { fetchOpenDataHubReport, fetchOpenMeteoForecast, pilotAreas } from './conditions-sources.ts';
import { withConditionsStore } from './conditions-store.ts';

const { values: options } = parseArgs({ options: {
    directory: { type: 'string', default: '.cache/ski-status' },
    bucket: { type: 'string' },
    forecasts: { type: 'boolean', default: false },
} });

for (const { areaId } of pilotAreas) {
    if (!skiAreas.some(area => area.id === areaId)) throw Error(`Unknown pilot ski area ${areaId}`);
}
const root = new URL('../data/', import.meta.url);
const catalogRevision = digest(Buffer.concat(await Promise.all(['areas.json', 'locations.json'].map(file => readFile(new URL(file, root))))));
const { coverage, received } = await withConditionsStore(resolve(options.directory), options.bucket, store => publishConditions(store, {
    areas: pilotAreas, catalogRevision, refreshForecasts: options.forecasts,
    fetchReport: fetchOpenDataHubReport, fetchForecast: fetchOpenMeteoForecast, warn: console.error,
}));
console.log(JSON.stringify({ coverage, received }, null, 2));
