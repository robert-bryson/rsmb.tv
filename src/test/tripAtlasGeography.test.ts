import { describe, expect, it } from 'vitest';
import { emptyAtlasFilters } from '../features/trips/atlas/tripAtlasBrowser';
import { atlasLocationBounds, atlasLocationFilters } from '../features/trips/atlas/tripAtlasGeography';
import { tripManifestSchema } from '../../shared/tripManifestSchema';

describe('atlas place exploration', () => {
    it('replaces geography while preserving year, mileage, and riding-day filters', () => {
        const filters = { ...emptyAtlasFilters(), from: '2024-01-01', to: '2024-12-31', daysMax: '7', milesMin: '500', countries: ['CA'], regions: ['GE/georgia'] };
        expect(atlasLocationFilters(filters, { country: 'US', region: 'Georgia' })).toEqual({ ...filters, countries: [], regions: ['US/georgia'] });
        expect(atlasLocationFilters(filters, { country: 'US' })).toEqual({ ...filters, countries: ['US'], regions: [] });
        expect(filters.countries).toEqual(['CA']);
    });

    it('uses country-qualified bounds, English aliases, and a short date-line span', () => {
        expect(atlasLocationBounds({ country: 'US', region: 'Georgia' })![2]).toBeLessThan(-80);
        expect(atlasLocationBounds({ country: 'GE' })![0]).toBeGreaterThan(0);
        expect(atlasLocationBounds({ country: 'CA', region: 'Québec' })).toEqual(atlasLocationBounds({ country: 'CA', region: 'Quebec' }));
        const us = atlasLocationBounds({ country: 'US' })!;
        expect(us[2] - us[0]).toBeLessThan(180);
        expect(Math.abs((us[0] + us[2]) / 2)).toBeLessThanOrEqual(180);
        expect(atlasLocationBounds({ country: 'US', region: 'Unknown place' })).toBeUndefined();
    });

    it('has finite geographic extents for every country and region in the authored trip collection', () => {
        const manifests = import.meta.glob('../content/trips/*.json', { eager: true, import: 'default' });
        for (const raw of Object.values(manifests)) {
            const manifest = tripManifestSchema.parse(raw);
            for (const country of manifest.countries ?? []) {
                for (const region of [undefined, ...country.regions ?? []]) {
                    const bounds = atlasLocationBounds({ country: country.code, region });
                    expect(bounds, `${manifest.id}: ${country.code}/${region ?? ''}`).toBeDefined();
                    expect(bounds!.every(Number.isFinite)).toBe(true);
                    expect(bounds![0]).toBeLessThan(bounds![2]);
                    expect(bounds![1]).toBeLessThan(bounds![3]);
                }
            }
        }
    });
});
