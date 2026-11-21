import { describe, expect, it } from 'vitest';
import { readResortAccess } from '../../shared/skiResortAccess';
import { skiAreas } from '../features/ski-status/catalog';
import { skiResortAccess } from '../features/ski-status/resortAccessData';

const source = 'https://example.test/winter';
const checkedOn = '2026-11-21';
const ids = [{ id: 'resort' }, { id: 'other' }];
const entrance = { base: 'Day lodge', coordinates: [-115, 51], result: 'confirmed', source };
const oldRecord = { checkedOn, mapPin: entrance };

describe('ski-status visitor records', () => {
    it('loads the newest verified season for each area and keeps older records for other areas', () => {
        const newRecord = { checkedOn: '2027-11-21', shuttle: { source, description: 'Free shuttle from the lower lot.' } };
        const current = { season: '2027/28', resorts: { resort: newRecord } };
        const previous = { season: '2026/27', resorts: { resort: oldRecord, other: oldRecord } };
        const data = readResortAccess([current, previous], ids);
        expect(data.get('resort')).toEqual({ ...newRecord, season: '2027/28' });
        expect(data.get('other')).toEqual({ ...oldRecord, season: '2026/27' });
    });

    it('rejects unknown areas, invalid source links and coordinates, and duplicate seasons', () => {
        const season = { season: '2026/27', resorts: { resort: oldRecord } };
        expect(() => readResortAccess([season], [])).toThrow('Visitor record has no ski area resort');
        expect(() => readResortAccess([season, season], ids)).toThrow('Duplicate visitor records for season 2026/27');
        expect(() => readResortAccess([{ season: '2026', resorts: { resort: { checkedOn, mapPin: { ...entrance, source: 'http://example.test/' } } } }], ids))
            .toThrow('Use an HTTPS source URL');
        expect(() => readResortAccess([{ season: '2026/27', resorts: { resort: { checkedOn, mapPin: { ...entrance, coordinates: [300, 51] } } } }], ids))
            .toThrow();
    });

    it('reads the actual batch prices, including free parking and published price caps', () => {
        const sunshine = skiResortAccess.get('banff-sunshine');
        expect(sunshine?.parking?.[0]).toMatchObject({ name: 'Main day lot', rates: [{ amount: 0, currency: 'CAD', appliesTo: 'day-use parking' }] });
        expect(sunshine?.liftTickets).toMatchObject({ currency: 'CAD', rates: [{ amount: 49 }] });
        expect(skiResortAccess.get('burke-mountain-resort')?.liftTickets?.rates)
            .toContainEqual(expect.objectContaining({ amount: 129, kind: 'maximum' }));
    });

    it('loads single-year visitor records with their published map edition', () => {
        const corralco = skiResortAccess.get('corralco-resort-de-montana');
        expect(corralco).toMatchObject({
            season: '2026',
            parking: expect.arrayContaining([expect.objectContaining({ name: 'Base 1600 parking' })]),
            trailMaps: expect.arrayContaining([expect.objectContaining({ season: '2026' })]),
        });
    });

    it('matches each checked base point to the point in the map catalog', () => {
        const areas = new Map(skiAreas.map(area => [area.id, area]));
        const entrances = [...skiResortAccess].filter(([, { mapPin }]) => mapPin);
        expect(entrances.length).toBeGreaterThan(50);
        for (const [id, { mapPin }] of entrances) {
            expect(areas.get(id)?.location.base?.coordinates, id).toEqual(mapPin?.coordinates);
        }
    });
});
