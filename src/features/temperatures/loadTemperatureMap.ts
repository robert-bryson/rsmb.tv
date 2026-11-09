import { MAPLIBRE_STYLESHEET, moduleLoader, settlePreparation } from '../../navigation/moduleLoader';
import { warmJson } from '../../data/warmJson';
import { RECENT_RECORDS_URL, SUMMARY_URL } from './constants';
import { recentRecordsSchema, temperatureSummarySchema } from './schemas';
import { temperatureDataView } from './temperatureDataView';

export const loadTemperatureMap = moduleLoader(() => import('./components/TemperatureMap').then(m => ({ default: m.TemperatureMap })), MAPLIBRE_STYLESHEET);

export async function warmTemperatureData(search: string, priority: RequestPriority = 'low') {
    const options = { priority };
    await settlePreparation([
        warmJson(SUMMARY_URL, value => temperatureSummarySchema.parse(value), options),
        ...(temperatureDataView(search) === 'recent' ? [warmJson(RECENT_RECORDS_URL, value => recentRecordsSchema.parse(value), options)] : []),
    ]);
}
