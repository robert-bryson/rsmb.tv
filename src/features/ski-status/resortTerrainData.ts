import manifest from '../../../projects/ski-status/data/resort-terrain.json';
import { skiAssetUrl, skiTerrainFile } from '../../../shared/skiAssets';
import type { SkiArea } from './catalog';

export const skiTerrainArchiveUrl = skiAssetUrl(skiTerrainFile(manifest.archiveSha256));
export const resortTerrainMinZoom = manifest.minZoom;
const groupsByArea = new Map(Object.entries(manifest.groupsByArea));

export type TerrainConvention = 'default' | 'europe' | 'japan';

export const terrainColors = {
    lift: '#fbbf24', nordic: '#22d3ee', touring: '#c084fc', park: '#fb923c', connector: '#a1a1aa',
    novice: '#86efac', easy: '#4ade80', blue: '#60a5fa', red: '#fb7185', advanced: '#18181b', freeride: '#fde047', unknown: '#d4d4d8',
};

export function resortTerrainGroups(areas: readonly SkiArea[]) {
    return [...new Set(areas.flatMap(area => groupsByArea.get(area.id) ?? []))];
}

export function skiRunLegend(convention: TerrainConvention) {
    return [
        { label: 'Novice', color: terrainColors.novice },
        { label: 'Easy', color: convention === 'europe' ? terrainColors.blue : terrainColors.easy },
        { label: 'Intermediate', color: convention === 'default' ? terrainColors.blue : terrainColors.red },
        { label: 'Advanced and harder', color: terrainColors.advanced },
    ];
}

export const skiTerrainLegend = [
    { label: 'Lift', color: terrainColors.lift, dashed: true }, { label: 'Nordic', color: terrainColors.nordic },
    { label: 'Ski touring', color: terrainColors.touring }, { label: 'Terrain park', color: terrainColors.park },
    { label: 'Freeride', color: terrainColors.freeride }, { label: 'Connector', color: terrainColors.connector },
    { label: 'Unrated run', color: terrainColors.unknown },
];
