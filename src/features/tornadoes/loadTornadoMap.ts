import { MAPLIBRE_STYLESHEET, moduleLoader, settlePreparation } from '../../navigation/moduleLoader';
import { warmJson } from '../../data/warmJson';
import { TORNADO_ANNUAL_SUMMARY_URL, TORNADO_NOTABLE_EVENTS_URL, TORNADO_DATA_TTL_MS } from './constants';
import { parseTornadoAnnualSummary } from '../../../shared/tornadoTrends';
import { notableEventsSchema } from './schemas';

export const loadTornadoMap = moduleLoader(() => import('./components/TornadoMap').then(m => ({ default: m.TornadoMap })), MAPLIBRE_STYLESHEET);

export async function warmTornadoData(priority: RequestPriority = 'low') {
    const options = { ttl: TORNADO_DATA_TTL_MS, priority };
    await settlePreparation([
        warmJson(TORNADO_ANNUAL_SUMMARY_URL, parseTornadoAnnualSummary, options),
        warmJson(TORNADO_NOTABLE_EVENTS_URL, value => notableEventsSchema.parse(value), options),
    ]);
}

export function startTornadoMap() {
    void warmTornadoData('auto').catch(() => { /* The mounted consumer owns visible errors. */ });
    return loadTornadoMap();
}
