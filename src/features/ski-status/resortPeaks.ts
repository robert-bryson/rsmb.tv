import { z } from 'zod';
import peakData from '../../../projects/ski-status/data/resort-peaks.json';
import { skiAreas } from './catalog';
import { httpsUrl, skiCoordinates, skiId } from './schemas';

const peakSchema = z.strictObject({
    id: skiId,
    name: z.string().trim().min(1),
    coordinates: skiCoordinates,
    elevationFt: z.number().int().positive().optional(),
    elevationSource: httpsUrl.optional(),
    locationSource: httpsUrl,
    checkedOn: z.iso.date(),
    trailMaps: z.array(z.strictObject({ areaId: skiId, source: httpsUrl })).min(1),
}).refine(peak => peak.elevationSource === undefined || peak.elevationFt !== undefined,
    { message: 'Elevation source requires a summit elevation', path: ['elevationSource'] });
type ResortPeak = z.infer<typeof peakSchema>;

export function readResortPeaks(input: unknown, areas: readonly { id: string }[]): readonly ResortPeak[] {
    const peaks = z.array(peakSchema).parse(input);
    const areaIds = new Set(areas.map(area => area.id));
    const peakIds = new Set<string>();
    for (const peak of peaks) {
        if (peakIds.has(peak.id)) throw new Error(`Duplicate peak ${peak.id}`);
        peakIds.add(peak.id);
        const mappedAreas = new Set<string>();
        for (const { areaId } of peak.trailMaps) {
            if (!areaIds.has(areaId)) throw new Error(`Peak ${peak.id} has no ski area ${areaId}`);
            if (mappedAreas.has(areaId)) throw new Error(`Duplicate trail map for ${peak.id} and ${areaId}`);
            mappedAreas.add(areaId);
        }
    }
    return peaks;
}

export const resortPeaks = readResortPeaks(peakData, skiAreas);
