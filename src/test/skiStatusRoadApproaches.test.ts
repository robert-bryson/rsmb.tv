import { describe, expect, it } from 'vitest';
import roadData from '../../projects/ski-status/research/road-approaches.json';
import { readSkiRoadApproaches } from '../../shared/skiRoadApproaches';
import { skiAreas } from '../features/ski-status/catalog';

const citation = { source: 'https://example.test/road', checkedOn: '2026-11-21' };
const pass = { ...citation, name: 'Example Pass', road: 'US 50', coordinates: [-120, 39] };
const route = { ...citation, from: 'Main junction', to: 'Public parking', roads: ['US 50'], passIds: ['example-pass'] };
const areas = [{ id: 'resort' }];
const readRoutes = (routes: readonly unknown[]) => readSkiRoadApproaches({
    approachesByArea: { resort: routes }, mountainPasses: { 'example-pass': pass },
}, areas);

describe('ski-status road approaches', () => {
    it('validates the research records against the catalog and the named crossings', () => {
        const { approachesByArea, mountainPasses } = readSkiRoadApproaches(roadData, skiAreas);
        expect(approachesByArea['palisades-tahoe']).toContainEqual(expect.objectContaining({
            from: 'Sacramento (I-80)', passIds: ['us-ca-donner-summit-i80'],
        }));
        expect(mountainPasses['us-ca-donner-summit-i80'].road).toBe('I-80');
    });

    it('keeps verified routes with no pass and routes with an open check distinct', () => {
        const noPass = { ...route, from: 'Base junction', passIds: [] };
        const unchecked = { ...route, from: 'Alternate junction', passIds: undefined };
        expect(readRoutes([noPass, unchecked, route]).approachesByArea.resort.map(row => row.passIds))
            .toEqual([[], undefined, ['example-pass']]);
    });

    it('rejects duplicate routes, unknown passes, and crossings on the wrong road', () => {
        expect(() => readRoutes([route, route])).toThrow('Duplicate road approach');
        expect(() => readRoutes([{ ...route, passIds: ['example-pass', 'example-pass'] }])).toThrow('Duplicate pass');
        expect(() => readRoutes([{ ...route, passIds: ['missing-pass'] }])).toThrow('Unknown road pass missing-pass');
        expect(() => readRoutes([{ ...route, roads: ['US 40'] }])).toThrow('without US 50');
        expect(() => readSkiRoadApproaches({ approachesByArea: { removed: [route] }, mountainPasses: {} }, areas))
            .toThrow('Road approach has no ski area removed');
    });

    it('requires valid coordinates, check dates, and HTTPS sources', () => {
        expect(() => readSkiRoadApproaches({ approachesByArea: {}, mountainPasses: {
            'example-pass': { ...pass, coordinates: [39, -120] },
        } }, areas)).toThrow();
        expect(() => readRoutes([{ ...route, checkedOn: '2026-11-31' }])).toThrow();
        expect(() => readRoutes([{ ...route, statusUrls: ['http://example.test/status'] }])).toThrow('Use an HTTPS source URL');
    });
});
