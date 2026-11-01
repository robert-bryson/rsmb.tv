import { describe, expect, it } from 'vitest';
import { defaultAtlasTableColumns, readAtlasTableColumns } from '../features/trips/atlas/tripAtlasTableColumns';

describe('atlas table column preferences', () => {
    it.each([undefined, null, 'old settings', {}, [null, { id: 'removed-column', visible: false }]])('recovers unusable saved preferences: %j', value => {
        expect(readAtlasTableColumns(value)).toEqual(defaultAtlasTableColumns());
    });

    it('preserves custom order and visibility, ignores duplicates, and appends new columns', () => {
        const saved = [
            { id: 'miles', visible: true }, { id: 'trip', visible: false }, { id: 'motorcycle', visible: false },
            { id: 'miles', visible: false }, { id: 'retired', visible: true }, { id: 'location', visible: 'invalid' },
        ];
        const columns = readAtlasTableColumns(saved);
        expect(columns).toEqual([
            { id: 'trip', visible: true }, { id: 'miles', visible: true }, { id: 'motorcycle', visible: false },
            { id: 'location', visible: true }, { id: 'dates', visible: true }, { id: 'days', visible: true }, { id: 'actions', visible: true },
        ]);
        expect(saved[1].visible).toBe(false);
    });

    it('keeps trip names available even when every column was saved as hidden', () => {
        const columns = readAtlasTableColumns(defaultAtlasTableColumns().map(column => ({ ...column, visible: false })));
        expect(columns.filter(column => column.visible)).toEqual([{ id: 'trip', visible: true }]);
    });
});
