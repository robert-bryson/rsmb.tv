import { z } from 'zod';
import { reportSnapshotSchema, forecastSnapshotSchema } from '../../../src/features/ski-status/conditions.ts';
import { isoTime } from '../../../src/features/ski-status/schemas.ts';

export const pilotAreas = [
    { areaId: 'alta-badia', sourceId: 'SKI04EBE61F5AA0473F871AF0297887D6C2', location: 'Corvara base', latitude: 46.5547, longitude: 11.8724 },
    { areaId: 'val-gardena-alpe-di-siusi', sourceId: 'SKI2C99CEA3DF2F458FB75E45CA39222E9D', location: 'Ortisei base', latitude: 46.5751, longitude: 11.6718 },
    { areaId: '3-zinnen-dolomites', sourceId: 'SKI04A713E6479A4BE4BD158019A6DA546C', location: 'Versciaco base', latitude: 46.7313, longitude: 12.3282 },
] as const;

type PilotArea = typeof pilotAreas[number];
const openDataHubLicense = 'https://databrowser.opendatahub.com/dataset-overview/f15d894a-b77f-43cf-a802-e1590fc38068';
const openMeteoLicense = 'https://creativecommons.org/licenses/by/4.0/';
const isoDate = z.iso.date();
const sourceTime = z.iso.datetime({ local: true, offset: true });
const amount = z.number().nonnegative();
const observation = z.object({
    LastUpdate: z.string(), Shortname: z.string().nullable(), SnowHeight: z.string().nullable(),
    newSnowHeight: z.string().nullable(), LastSnowDate: z.string().nullable(), Source: z.string(),
});
const hubReports = z.object({ Items: z.array(z.object({
    RID: z.string(), LastUpdate: z.string(), Measuringpoints: z.array(observation).nullish(),
    openskilift: z.string().nullable(), totalskilift: z.string().nullable(),
    openskislopes: z.string().nullable(), totalskislopes: z.string().nullable(),
})) });
const meteoForecast = z.object({
    utc_offset_seconds: z.literal(0), elevation: z.number(),
    hourly_units: z.object({ temperature_2m: z.literal('°C'), precipitation_probability: z.literal('%'), snowfall: z.literal('cm') }),
    hourly: z.object({
        time: z.array(z.iso.datetime({ local: true, precision: -1 }).refine(value => !value.endsWith('Z'))),
        temperature_2m: z.array(z.number().nullable()), precipitation_probability: z.array(amount.max(100).nullable()),
        snowfall: z.array(amount.nullable()),
    }).refine(({ time, temperature_2m, precipitation_probability, snowfall }) =>
        [temperature_2m, precipitation_probability, snowfall].every(series => series.length === time.length),
    'Open-Meteo hourly values must match the time series'),
});

async function fetchJson(url: URL) {
    const result = await fetch(url, { signal: AbortSignal.timeout(30_000), headers: { accept: 'application/json' } });
    if (!result.ok) throw Error(`${url.hostname} returned HTTP ${result.status}`);
    return result.json() as Promise<unknown>;
}

function numberOrUnknown(value?: string | null) {
    const clean = value?.trim();
    if (clean && /^\d+(?:\.\d+)?$/.test(clean)) return amount.safeParse(Number(clean)).data;
}

function sourceDate(value?: string | null) {
    if (!value || value.startsWith('0001-')) return;
    if (isoDate.safeParse(value).success) return value;
    if (sourceTime.safeParse(value).success) return value.slice(0, 10);
}

function openCounts(open: string | null, total: string | null) {
    const counts = { open: numberOrUnknown(open), total: numberOrUnknown(total) };
    return counts.open !== undefined || counts.total !== undefined ? counts : undefined;
}

export function openDataHubReport(payload: unknown, area: PilotArea, url: string, retrievedAt: string) {
    const { Items } = hubReports.parse(payload);
    const matches = Items.filter(entry => entry.RID === area.sourceId);
    if (!matches.length) throw Error(`Open Data Hub omitted ${area.areaId}`);
    if (matches.length > 1) throw Error(`Open Data Hub returned duplicate reports for ${area.areaId}`);
    const [item] = matches;
    const reportedOn = sourceDate(item.LastUpdate);
    const reportedAt = reportedOn && isoTime.safeParse(item.LastUpdate).data;
    const lifts = openCounts(item.openskilift, item.totalskilift);
    const trails = openCounts(item.openskislopes, item.totalskislopes);
    const base = item.Measuringpoints?.flatMap(point => {
        if (point.Source !== 'lts' || point.Shortname !== 'Talstation') return [];
        const snowReportedOn = sourceDate(point.LastUpdate);
        if (!snowReportedOn) return [];
        const baseCm = numberOrUnknown(point.SnowHeight);
        const snowfallOn = sourceDate(point.LastSnowDate);
        const snowfallCm = snowfallOn ? numberOrUnknown(point.newSnowHeight) : undefined;
        if (baseCm === undefined && snowfallCm === undefined) return [];
        return [{ time: point.LastUpdate, baseCm, snowfallCm, snowfallOn: snowfallCm === undefined ? undefined : snowfallOn, snowReportedOn }];
    }).sort((first, second) => second.time.localeCompare(first.time))[0];
    if (!lifts && !trails && !base) throw Error(`Open Data Hub returned no measurements for ${area.areaId}`);

    let status: 'open' | 'limited' | 'unknown' = 'unknown';
    if (lifts?.open && trails?.open && lifts.total !== undefined && trails.total !== undefined) {
        status = lifts.open === lifts.total && trails.open === trails.total ? 'open' : 'limited';
    }
    const { reports: [report] } = reportSnapshotSchema.parse({
        version: 1, generatedAt: retrievedAt,
        reports: [{
            areaId: area.areaId, source: { name: 'Open Data Hub / LTS', url, license: openDataHubLicense, exportable: true },
            retrievedAt, reportedAt, reportedOn, status, lifts, trails, baseCm: base?.baseCm,
            snowfallCm: base?.snowfallCm, snowfallOn: base?.snowfallOn,
            snowReportedOn: base?.snowReportedOn, snowLocation: base && 'Lower station',
        }],
    });
    return report;
}

export async function fetchOpenDataHubReport(area: PilotArea) {
    const url = new URL('https://tourism.api.opendatahub.com/v1/Weather/SnowReport');
    url.search = new URLSearchParams({ lang: 'de', skiareaid: area.sourceId, pagesize: '5' }).toString();
    return openDataHubReport(await fetchJson(url), area, url.href, new Date().toISOString());
}

const hour = 3_600_000;

export function openMeteoForecast(payload: unknown, area: PilotArea, url: string, retrievedAt: string) {
    const { hourly, elevation } = meteoForecast.parse(payload);
    const times = hourly.time.map(value => Date.parse(`${value}Z`));
    const start = times.findIndex(value => value >= Date.parse(retrievedAt));
    const end = start + 24;
    if (start < 0 || end >= times.length || times.slice(start, end + 1).some((value, index) => value !== times[start] + index * hour)) {
        throw Error(`Open-Meteo lacks 24 consecutive hours for ${area.areaId}`);
    }
    // The API labels accumulations with the end of each hour.
    const snow = hourly.snowfall.slice(start + 1, end + 1);
    const precipitation = hourly.precipitation_probability.slice(start + 1, end + 1);
    const { forecasts: [forecast] } = forecastSnapshotSchema.parse({
        version: 1, generatedAt: retrievedAt,
        forecasts: [{
            areaId: area.areaId, source: { name: 'Open-Meteo', url, license: openMeteoLicense, exportable: true },
            retrievedAt, startsAt: new Date(times[start]).toISOString(), endsAt: new Date(times[end]).toISOString(),
            location: area.location, elevationM: elevation, temperatureC: hourly.temperature_2m[start] ?? undefined,
            snowfallCm: snow.every(value => value !== null) ? snow.reduce((sum, value) => sum + value, 0) : undefined,
            precipitationPct: precipitation.every(value => value !== null) ? Math.max(...precipitation) : undefined,
        }],
    });
    return forecast;
}

export async function fetchOpenMeteoForecast(area: PilotArea) {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.search = new URLSearchParams({
        latitude: String(area.latitude), longitude: String(area.longitude), timezone: 'GMT', forecast_days: '3',
        hourly: 'temperature_2m,snowfall,precipitation_probability',
    }).toString();
    return openMeteoForecast(await fetchJson(url), area, url.href, new Date().toISOString());
}
