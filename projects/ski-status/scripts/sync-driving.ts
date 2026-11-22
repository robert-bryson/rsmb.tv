import { parseArgs } from 'node:util';
import { drivingDirectory, drivingPrefix } from '../../../shared/skiDriving.ts';
import { readResponseBytes } from '../../../shared/readResponseBytes.ts';
import { decodeConditionsJson, decodeConditionsText } from '../../../src/features/ski-status/conditions-response.ts';
import { withConditionsStore } from './conditions-store.ts';
import { publishDriving, type DrivingCollectors } from './driving-publication.ts';
import { caltransCameras, caltransChains, caltransClosures, driveBcCameras, driveBcEvents, udotCameras, udotEvents,
    wsdotAlerts, wsdotCameras, wsdotPasses } from './driving-parsers.ts';

const inboundLimit = 5 * 1024 * 1024;
export function createDrivingCollectors(fetcher: typeof fetch, key?: string): DrivingCollectors {
    async function read(url: string | URL, accept: string) {
        const response = await fetcher(url, { signal: AbortSignal.timeout(15_000), redirect: 'error', headers: { accept } });
        return readResponseBytes(response, inboundLimit, 'Road agency feed');
    }
    const json = async (url: string | URL) => decodeConditionsJson(await read(url, 'application/json'));
    const wsdot = async (feed: string) => decodeConditionsText(await read(
        `https://www.wsdot.wa.gov/traffic/api/${feed}/kml.aspx`, 'application/vnd.google-earth.kml+xml'));

    const collectors: DrivingCollectors = {
        wsdot: {
            async reports() {
                const [alerts, passes] = await Promise.all([wsdot('HighwayAlerts'), wsdot('MountainPassConditions')]);
                return [...wsdotAlerts(alerts), ...wsdotPasses(passes)];
            },
            cameras: async () => wsdotCameras(await wsdot('HighwayCameras')),
        },
        drivebc: {
            reports: async () => driveBcEvents(await json('https://api.open511.gov.bc.ca/events?road_name=Highway%2099&status=ACTIVE&limit=500')),
            cameras: async () => driveBcCameras(await json('https://www.drivebc.ca/api/webcams/')),
        },
        caltrans: {
            async reports() {
                const [chains, closures] = await Promise.all([
                    json('https://cwwp2.dot.ca.gov/data/d3/cc/ccStatusD03.json'),
                    json('https://cwwp2.dot.ca.gov/data/d3/lcs/lcsStatusD03.json'),
                ]);
                return [...caltransChains(chains), ...caltransClosures(closures)];
            },
            cameras: async () => caltransCameras(await json('https://cwwp2.dot.ca.gov/data/d3/cctv/cctvStatusD03.json')),
        },
    };

    const udotKey = key?.trim();
    if (udotKey) {
        const utah = (feed: 'event' | 'cameras') => {
            const url = new URL(`https://www.udottraffic.utah.gov/api/v2/get/${feed}`);
            url.searchParams.set('key', udotKey);
            return json(url);
        };
        collectors.udot = {
            reports: async () => udotEvents(await utah('event')),
            cameras: async () => udotCameras(await utah('cameras')),
        };
    }
    return collectors;
}

if (import.meta.main) {
    const { values } = parseArgs({ options: { bucket: { type: 'string' }, directory: { type: 'string' } } });
    const collectors = createDrivingCollectors(fetch, process.env.UDOT_API_KEY);
    const manifest = await withConditionsStore(values.directory ?? drivingDirectory, values.bucket,
        store => publishDriving(store, collectors), undefined, drivingPrefix);
    const providers = Object.entries(manifest.providers);
    for (const [provider, feeds] of providers) {
        console.log(`${provider} reports=${feeds.reports.status} cameras=${feeds.cameras.status}`);
    }
    if (!providers.some(([, feeds]) => feeds.reports.status === 'available')) {
        console.error('No road agency reports updated. Published the latest feed status.');
        process.exitCode = 1;
    }
}
