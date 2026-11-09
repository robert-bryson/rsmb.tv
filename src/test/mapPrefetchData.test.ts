import { afterEach, expect, it, vi } from 'vitest';
import { warmTemperatureData } from '../features/temperatures/loadTemperatureMap';
import { warmTornadoData } from '../features/tornadoes/loadTornadoMap';
import { warmFlightData } from '../features/flights/loadFlightsMap';
import { clearCache, fetchWithCache } from '../data/fetchCache';
import { makeNotableEvent } from './helpers/tornadoes';
import { fetchValidatedJson } from '../data/validatedJson';
import { notableEventsSchema } from '../features/tornadoes/schemas';
import { TORNADO_DATA_TTL_MS, TORNADO_NOTABLE_EVENTS_URL } from '../features/tornadoes/constants';

afterEach(() => { clearCache(); vi.unstubAllGlobals(); });

it('warms only the temperature resources needed by the selected view', async () => {
    const fetch = vi.fn(async (url: string) => Response.json(url.endsWith('summary.json')
        ? { lastUpdated: '2026-11-03', stateRecordCount: 0, countyRecordCount: 0, statesProcessed: 48 }
        : { asOf: '2026-11-03', dates: ['2026-11-02'], yesterday: [], last7Days: [] }));
    vi.stubGlobal('fetch', fetch);
    await warmTemperatureData('?view=county');
    expect(fetch.mock.calls.map(([url]) => url.split('/').pop())).toEqual(['summary.json']);
    await warmTemperatureData('?view=recent');
    expect(fetch.mock.calls.map(([url]) => url.split('/').pop())).toEqual(['summary.json', 'recentRecords.json']);
});

it('warms tornado metadata without historical geometry, chart aggregates, or warning requests', async () => {
    const fetch = vi.fn(async (url: string) => Response.json(url.endsWith('annual-summary.json') ? [{
        year: 2025, count: 0, unknown: 0, ef0: 0, ef1: 0, ef2: 0, ef3: 0, ef4: 0, ef5: 0,
        ef1Plus: 0, ef2Plus: 0, deaths: 0, injuries: 0, trackMiles: 0, medianWidthYards: 0,
    }] : []));
    vi.stubGlobal('fetch', fetch);
    await warmTornadoData();
    expect(fetch.mock.calls.map(([url]) => url.split('/').pop()).sort()).toEqual(['annual-summary.json', 'notable-events.json']);
    await fetchWithCache('https://data.rsmb.tv/tornadoes/annual-summary.json', { ttl: 30 * 60_000 });
    expect(fetch).toHaveBeenCalledTimes(2);
});

it('rejects a malformed speculative flight snapshot instead of retaining it for navigation', async () => {
    const fetch = vi.fn().mockImplementation(async () => Response.json({ malformed: true }));
    vi.stubGlobal('fetch', fetch);
    await expect(warmFlightData()).rejects.toThrow();
    fetch.mockImplementation(async () => Response.json({ recovered: true }));
    expect(await fetchWithCache('/data/flights/flights.geojson')).toEqual({ recovered: true });
    expect(fetch).toHaveBeenCalledTimes(3);
});

it('discards malformed speculative notable events before a demanded read', async () => {
    const valid = [makeNotableEvent()];
    let repaired = false;
    const fetch = vi.fn(async (url: string) => Response.json(url.endsWith('notable-events.json')
        ? repaired ? valid : { malformed: true }
        : [{ year: 2025, count: 0, unknown: 0, ef0: 0, ef1: 0, ef2: 0, ef3: 0, ef4: 0, ef5: 0,
            ef1Plus: 0, ef2Plus: 0, deaths: 0, injuries: 0, trackMiles: 0, medianWidthYards: 0 }]));
    vi.stubGlobal('fetch', fetch);
    await expect(warmTornadoData()).rejects.toThrow();
    repaired = true;
    const result = await fetchValidatedJson(TORNADO_NOTABLE_EVENTS_URL, value => notableEventsSchema.parse(value), { ttl: TORNADO_DATA_TTL_MS });
    expect(result).toEqual(valid);
    expect(fetch.mock.calls.filter(([url]) => url.endsWith('notable-events.json'))).toHaveLength(2);
});

it.each(['?view=county', '?view=state', '?view=freshness'])('keeps large temperature archives out of preparation for %s', async search => {
    const fetch = vi.fn(async () => Response.json({ lastUpdated: '2026-11-03', stateRecordCount: 0, countyRecordCount: 0, statesProcessed: 48 }));
    vi.stubGlobal('fetch', fetch);
    await warmTemperatureData(search);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]).toEqual([expect.stringMatching(/summary\.json$/), expect.objectContaining({ priority: 'low' })]);
});

it('uses normal priority when temperature data is required by navigation', async () => {
    const fetch = vi.fn(async () => Response.json({ lastUpdated: '2026-11-03', stateRecordCount: 0, countyRecordCount: 0, statesProcessed: 48 }));
    vi.stubGlobal('fetch', fetch);
    await warmTemperatureData('?view=county', 'auto');
    expect(fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ priority: 'auto' }));
});
