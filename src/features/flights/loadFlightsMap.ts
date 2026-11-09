import { moduleLoader, settlePreparation } from '../../navigation/moduleLoader';
import { warmJson } from '../../data/warmJson';
import { flightsSchema, visitedAirportsSchema } from '../../../shared/flightSchemas';

export const loadFlightsMap = moduleLoader(() => import('./components/FlightsMap').then(m => ({ default: m.FlightsMap })));

export async function warmFlightData(priority: RequestPriority = 'low') {
    await settlePreparation([
        warmJson(`${import.meta.env.BASE_URL}data/flights/flights.geojson`, value => flightsSchema.parse(value), { priority }),
        warmJson(`${import.meta.env.BASE_URL}data/flights/visitedAirports.geojson`, value => visitedAirportsSchema.parse(value), { priority }),
    ]);
}

export function startFlightsMap() {
    void warmFlightData('auto').catch(() => { /* The mounted consumer owns visible errors. */ });
    return loadFlightsMap();
}
