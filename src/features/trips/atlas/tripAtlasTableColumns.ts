export const atlasTableColumns = [
    { id: 'trip', name: 'Trip', minWidth: 192, ascending: 'title-asc', descending: 'title-desc' },
    { id: 'motorcycle', name: 'Motorcycle', minWidth: 144 },
    { id: 'dates', name: 'Trip dates', minWidth: 128, ascending: 'oldest', descending: 'newest' },
    { id: 'days', name: 'Riding days', minWidth: 112, ascending: 'days-asc', descending: 'days-desc' },
    { id: 'miles', name: 'Miles', minWidth: 96, ascending: 'miles-asc', descending: 'miles-desc' },
    { id: 'location', name: 'Location', minWidth: 176, ascending: 'location-asc', descending: 'location-desc' },
    { id: 'actions', name: 'Reports', minWidth: 200 },
] as const;

export type AtlasTableColumnId = typeof atlasTableColumns[number]['id'];
export interface AtlasTableColumnSetting { id: AtlasTableColumnId; visible: boolean }
export const atlasTableColumnsStorageKey = 'rsmb:adv-atlas:table-columns:v1';

export function defaultAtlasTableColumns(): AtlasTableColumnSetting[] {
    return atlasTableColumns.map(column => ({ id: column.id, visible: true }));
}

/** Preserve valid preferences, append new columns, and always retain the row heading. */
export function readAtlasTableColumns(value: unknown): AtlasTableColumnSetting[] {
    const result: AtlasTableColumnSetting[] = [{ id: 'trip', visible: true }];
    if (Array.isArray(value)) for (const item of value) {
        if (!item || typeof item !== 'object') continue;
        const column = atlasTableColumns.find(column => column.id === item.id);
        if (column && !result.some(saved => saved.id === column.id)) {
            result.push({ id: column.id, visible: typeof item.visible === 'boolean' ? item.visible : true });
        }
    }
    for (const column of atlasTableColumns) {
        if (!result.some(saved => saved.id === column.id)) result.push({ id: column.id, visible: true });
    }
    return result;
}
