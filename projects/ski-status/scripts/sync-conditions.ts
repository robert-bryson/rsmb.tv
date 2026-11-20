import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { skiAreas } from '../../../src/features/ski-status/catalog.ts';
import { digest, publishConditions } from './conditions-publication.ts';
import { fetchOpenDataHubReport, fetchOpenMeteoForecast, pilotAreas } from './conditions-sources.ts';
import { withConditionsStore } from './conditions-store.ts';
import { fetchLakeLouiseReport, lakeLouiseBase } from './lake-louise-source.ts';
import { fetchSkiBig3Report, skiBig3Areas } from './ski-big3-source.ts';

const { values: options } = parseArgs({ options: {
    directory: { type: 'string' },
    bucket: { type: 'string' },
    forecasts: { type: 'boolean', default: false },
    'rockies-pilot': { type: 'boolean', default: false },
} });

const rockiesPilot = options['rockies-pilot'];
if (rockiesPilot && options.bucket) throw Error('The Rockies pilot is local pending feed reuse confirmation.');
const directory = options.directory ?? (rockiesPilot ? '.cache/ski-status-rockies' : '.cache/ski-status');
const areas = rockiesPilot ? [lakeLouiseBase, ...skiBig3Areas] : [...pilotAreas, lakeLouiseBase];
for (const { areaId } of areas) {
    if (!skiAreas.some(area => area.id === areaId)) throw Error(`Unknown ski area for conditions: ${areaId}`);
}
const root = new URL('../data/', import.meta.url);
const catalogRevision = digest(Buffer.concat(await Promise.all(['areas.json', 'locations.json'].map(file => readFile(new URL(file, root))))));
const { coverage, received } = await withConditionsStore(resolve(directory), options.bucket, store => publishConditions<(typeof areas)[number]>(store, {
    areas, catalogRevision, refreshForecasts: options.forecasts,
    fetchReport: (area, previous) => {
        if ('sourceId' in area) return fetchOpenDataHubReport(area, previous);
        return 'feed' in area ? fetchSkiBig3Report(area) : fetchLakeLouiseReport();
    },
    fetchForecast: fetchOpenMeteoForecast, warn: console.error,
}));
console.log(JSON.stringify({ coverage, received }, null, 2));
