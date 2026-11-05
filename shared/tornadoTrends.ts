/** Chart data has no geometry. Width histograms preserve medians across filters. */
export interface TornadoTrendGroup {
    year: number;
    state: string;
    scale: number;
    count: number;
    deaths: number;
    injuries: number;
    trackMiles: number;
    widths: [number, number][];
}

export interface TornadoTrendIndex {
    version: 1;
    groups: TornadoTrendGroup[];
}

interface TrendTrack {
    properties: Pick<TornadoTrendGroup, 'year' | 'state' | 'scale' | 'deaths' | 'injuries'> & { lengthMiles: number; widthYards: number };
}

export interface AnnualTornadoSummary {
    year: number;
    count: number;
    unknown: number;
    ef0: number;
    ef1: number;
    ef2: number;
    ef3: number;
    ef4: number;
    ef5: number;
    ef1Plus: number;
    ef2Plus: number;
    deaths: number;
    injuries: number;
    trackMiles: number;
    medianWidthYards: number;
}

export const MIN_TORNADO_YEAR = 1950;
const ANNUAL_METRICS = [
    'count', 'unknown', 'ef0', 'ef1', 'ef2', 'ef3', 'ef4', 'ef5', 'ef1Plus', 'ef2Plus',
    'deaths', 'injuries', 'trackMiles', 'medianWidthYards',
] as const satisfies readonly (keyof AnnualTornadoSummary)[];

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonnegativeNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isNonnegativeInteger(value: unknown): value is number {
    return isNonnegativeNumber(value) && Number.isSafeInteger(value);
}

function isAnnualSummary(value: unknown, maxYear: number): value is AnnualTornadoSummary {
    if (!isRecord(value) || !isNonnegativeInteger(value.year) || value.year < MIN_TORNADO_YEAR || value.year > maxYear) return false;
    return ANNUAL_METRICS.every(key => key === 'trackMiles' || key === 'medianWidthYards'
        ? isNonnegativeNumber(value[key]) : isNonnegativeInteger(value[key]));
}

export function parseTornadoAnnualSummary(value: unknown, maxYear = new Date().getFullYear()): AnnualTornadoSummary[] {
    const fail = () => { throw new Error('Invalid tornado annual summary; no geometry was requested.'); };
    if (!Array.isArray(value) || value.length === 0) return fail();
    const years = new Set<number>();
    const rows: AnnualTornadoSummary[] = [];
    for (const row of value) {
        if (!isAnnualSummary(row, maxYear) || years.has(row.year)) return fail();
        years.add(row.year);
        rows.push(row);
    }
    return rows.sort((a, b) => a.year - b.year);
}

/** Accepts normalized county segments from the ingestion pipeline. */
export function buildTornadoTrendIndex(tracks: readonly TrendTrack[]): TornadoTrendIndex {
    const groups = new Map<string, TornadoTrendGroup & { histogram: Map<number, number> }>();
    for (const { properties: p } of tracks) {
        const scale = p.scale >= 0 && p.scale <= 5 ? p.scale : -1;
        const key = `${p.year}:${p.state}:${scale}`;
        let group = groups.get(key);
        if (!group) {
            group = { year: p.year, state: p.state, scale, count: 0, deaths: 0, injuries: 0, trackMiles: 0, widths: [], histogram: new Map() };
            groups.set(key, group);
        }
        group.count++;
        group.deaths += p.deaths;
        group.injuries += p.injuries;
        // Source lengths have two decimal places. Sum hundredths without order-dependent rounding.
        group.trackMiles += Math.round(p.lengthMiles * 100);
        if (p.widthYards > 0) group.histogram.set(p.widthYards, (group.histogram.get(p.widthYards) ?? 0) + 1);
    }
    return { version: 1, groups: [...groups.values()]
        .sort((a, b) => a.year - b.year || a.state.localeCompare(b.state) || a.scale - b.scale)
        .map(({ histogram, ...group }) => ({ ...group, trackMiles: group.trackMiles / 100, widths: [...histogram].sort((a, b) => a[0] - b[0]) })) };
}

function isTrendGroup(value: unknown): value is TornadoTrendGroup {
    if (!isRecord(value) || !isNonnegativeInteger(value.year) || value.year < MIN_TORNADO_YEAR
        || typeof value.state !== 'string' || !/^[A-Z]{2}$/.test(value.state)
        || typeof value.scale !== 'number' || !Number.isInteger(value.scale) || value.scale < -1 || value.scale > 5
        || !isNonnegativeInteger(value.count) || value.count === 0
        || !isNonnegativeInteger(value.deaths) || !isNonnegativeInteger(value.injuries)
        || !isNonnegativeNumber(value.trackMiles) || !Array.isArray(value.widths)) return false;
    let previousWidth = 0;
    let knownWidths = 0;
    for (const pair of value.widths) {
        if (!Array.isArray(pair) || pair.length !== 2 || !isNonnegativeNumber(pair[0]) || pair[0] <= previousWidth
            || !isNonnegativeInteger(pair[1]) || pair[1] === 0) return false;
        previousWidth = pair[0];
        knownWidths += pair[1];
        if (!Number.isSafeInteger(knownWidths) || knownWidths > value.count) return false;
    }
    return true;
}

/** Rejects partial archives and incompatible publication/cache generations. */
export function parseTornadoTrendIndex(value: unknown, annualSummary: readonly AnnualTornadoSummary[]): TornadoTrendIndex {
    const fail = () => { throw new Error('Invalid tornado trend aggregates. Refresh the published trend data and retry.'); };
    if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.groups)) return fail();
    const keys = new Set<string>();
    const groups: TornadoTrendGroup[] = [];
    for (const group of value.groups) {
        if (!isTrendGroup(group)) return fail();
        const key = `${group.year}:${group.state}:${group.scale}`;
        if (keys.has(key)) return fail();
        keys.add(key);
        groups.push(group);
    }
    const index: TornadoTrendIndex = { version: 1, groups };
    const publishedYears = new Set(annualSummary.map(row => row.year));
    const calculated = summarizeTornadoTrends(index, {}, [...publishedYears]);
    const totals = new Map(calculated.map(row => [row.year, row]));
    if (totals.size !== publishedYears.size || annualSummary.some(expected => {
        const actual = totals.get(expected.year);
        return !actual || ANNUAL_METRICS.some(key => actual[key] !== expected[key]);
    })) throw new Error('Tornado trend data does not match the annual summary. Retry to load matching data.');
    return index;
}

function emptyYear(year: number): AnnualTornadoSummary {
    return { year, count: 0, unknown: 0, ef0: 0, ef1: 0, ef2: 0, ef3: 0, ef4: 0, ef5: 0,
        ef1Plus: 0, ef2Plus: 0, deaths: 0, injuries: 0, trackMiles: 0, medianWidthYards: 0 };
}

function histogramMedian(histogram: Map<number, number>): number {
    const bins = [...histogram].sort((a, b) => a[0] - b[0]);
    const count = bins.reduce((sum, [, frequency]) => sum + frequency, 0);
    if (!count) return 0;
    const lowerIndex = Math.floor((count - 1) / 2);
    const upperIndex = Math.floor(count / 2);
    let seen = 0;
    let lower = 0;
    for (const [width, frequency] of bins) {
        if (seen <= lowerIndex && seen + frequency > lowerIndex) lower = width;
        if (seen + frequency > upperIndex) return Math.round((lower + width) * 5) / 10;
        seen += frequency;
    }
    return 0;
}

export function summarizeTornadoTrends(index: TornadoTrendIndex,
    { states = [], minScale = -1, maxScale = 5 }: { states?: readonly string[]; minScale?: number; maxScale?: number } = {},
    yearDomain: readonly number[] = []): AnnualTornadoSummary[] {
    const years = new Map(yearDomain.map(year => [year, emptyYear(year)]));
    const widths = new Map<number, Map<number, number>>();
    for (const group of index.groups) {
        if ((states.length && !states.includes(group.state)) || group.scale < minScale || group.scale > maxScale) continue;
        const row = years.get(group.year) ?? emptyYear(group.year);
        years.set(group.year, row);
        row.count += group.count;
        row.deaths += group.deaths;
        row.injuries += group.injuries;
        row.trackMiles += Math.round(group.trackMiles * 100);
        if (group.scale < 0) row.unknown += group.count;
        else {
            row[`ef${group.scale}` as 'ef0'] += group.count;
            if (group.scale >= 1) row.ef1Plus += group.count;
            if (group.scale >= 2) row.ef2Plus += group.count;
        }
        const histogram = widths.get(group.year) ?? new Map<number, number>();
        widths.set(group.year, histogram);
        for (const [width, count] of group.widths) histogram.set(width, (histogram.get(width) ?? 0) + count);
    }
    return [...years.values()].sort((a, b) => a.year - b.year).map(row => ({ ...row,
        trackMiles: row.trackMiles / 100, medianWidthYards: histogramMedian(widths.get(row.year) ?? new Map()) }));
}
