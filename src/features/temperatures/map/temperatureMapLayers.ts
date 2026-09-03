import type { BrokenRecord, CountyRecordsCollection, TimePeriod } from '../types';
import { yearToColor } from '../constants';

function hasMapCoordinates(record: BrokenRecord): boolean {
    return Number.isFinite(record.lat)
        && Number.isFinite(record.lon)
        && !(record.lat === 0 && record.lon === 0);
}

export function buildBrokenRecordsGeoJson(records: BrokenRecord[], period: TimePeriod) {
    return {
        type: 'FeatureCollection' as const,
        features: records
            .filter(hasMapCoordinates)
            .map(record => ({
                type: 'Feature' as const,
                geometry: { type: 'Point' as const, coordinates: [record.lon, record.lat] as [number, number] },
                properties: {
                    stationName: record.stationName,
                    uid: record.uid,
                    state: record.state,
                    stateName: record.stateName,
                    county: record.county,
                    type: record.type,
                    tempF: record.tempF,
                    prevRecordF: record.prevRecordF,
                    prevRecordDate: record.prevRecordDate,
                    normalF: record.normalF,
                    date: record.date,
                    recordScope: record.recordScope,
                    period,
                },
            })),
    };
}

export function buildFreshnessGeoJson(countyRecords: CountyRecordsCollection, recordType: 'high' | 'low') {
    const features = countyRecords.features
        .filter(feature => feature.properties.type === recordType)
        .map(feature => {
            const year = Number.parseInt(feature.properties.date.slice(0, 4), 10);
            const safeYear = Number.isNaN(year) ? 1900 : year;
            return {
                ...feature,
                properties: {
                    ...feature.properties,
                    year: safeYear,
                    color: yearToColor(safeYear),
                },
            };
        });

    return { type: 'FeatureCollection' as const, features };
}