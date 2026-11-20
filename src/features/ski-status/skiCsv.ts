import { conditionColumns, formatSkiStat, visibleSkiColumns, type ColumnKey, type SkiUnits } from './browse';
import { locationAttribution, locationLicense, type SkiArea } from './catalog';
import { areaForecast, type Conditions } from './conditions';

const identityFields = new Set<ColumnKey>(['name', 'region', 'skiing']);
const liveFields = new Set<ColumnKey>([...conditionColumns.map(({ key }) => key), 'opensOn']);

function csvCell(value = '') {
    const safe = /^[\s\p{Cc}\p{Cf}]*[=+\-@＝＋－＠]|^[\t\r\n]/u.test(value) ? `'${value}` : value;
    return `"${safe.replaceAll('"', '""')}"`;
}

function exportSource(area: SkiArea, key: ColumnKey, conditions?: Conditions) {
    if (identityFields.has(key)) return { url: area.website };
    if (key.startsWith('mapped')) {
        const mapped = area.location.mappedTerrain;
        return mapped && { url: mapped.source, license: locationLicense };
    }
    if (liveFields.has(key)) {
        const entry = key.startsWith('forecast') ? areaForecast(conditions, area.id) : conditions?.reports.get(area.id);
        if (entry?.source.exportable) return entry.source;
        return;
    }
    const source = area.statSources?.find(citation => citation.fields.some(field => field === key) && citation.exportLicense);
    if (source) return { url: source.source, license: source.exportLicense };
}

export function skiAreaCsv(areas: readonly SkiArea[], preferences: readonly ColumnKey[], units: SkiUnits, conditions?: Conditions) {
    const columns = visibleSkiColumns(preferences).filter(({ key }) => identityFields.has(key) || areas.some(area => exportSource(area, key, conditions)));
    const header = [...columns.map(({ label }) => label), 'Report time', 'Snow measurement date', 'Forecast issued', 'Forecast from', 'Forecast through',
        'Forecast location', 'Sources', 'Data licenses', 'Attribution'];
    const rows = areas.map(area => {
        const sources = new Set<string>();
        const licenses = new Set<string>();
        const credits = new Set<string>();
        let exportedTerrain = false;
        let exportedReport = false;
        let exportedForecast = false;
        const values = columns.map(({ key }) => {
            const source = exportSource(area, key, conditions);
            if (!source) return;
            const value = formatSkiStat(area, key, units, conditions);
            if (value === undefined) return;
            sources.add(source.url);
            if (source.license) licenses.add(source.license);
            if ('name' in source) credits.add(source.name);
            if (key.startsWith('mapped')) exportedTerrain = true;
            if (liveFields.has(key)) {
                if (key.startsWith('forecast')) exportedForecast = true;
                else exportedReport = true;
            }
            return value;
        });
        const report = exportedReport ? conditions?.reports.get(area.id) : undefined;
        const forecast = exportedForecast ? areaForecast(conditions, area.id) : undefined;
        if (exportedTerrain) {
            for (const [name, url] of Object.entries(locationAttribution)) credits.add(`${name} (${url})`);
        }
        return [...values, report?.reportedAt ?? report?.reportedOn, report?.snowReportedOn, forecast?.issuedAt, forecast?.startsAt, forecast?.endsAt,
            forecast?.location, [...sources].join(' | '), [...licenses].join(' | '), [...credits].join(' | ')];
    });
    return [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function downloadSkiAreaCsv(csv: string) {
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ski-status.csv';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
