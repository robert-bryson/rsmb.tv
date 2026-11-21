import { z } from 'zod';
import seasonData from '../../../projects/ski-status/data/seasons.json';
import { skiAreas, type SkiArea } from './catalog';
import { isFreshReport, type Conditions, type ResortReport } from './conditions';
import { localSkiDate } from './localSkiDate';
import { httpsUrl, passSeasonId, skiId } from './schemas';

const date = z.iso.date();
const month = z.int().min(1).max(12);
const source = skiId;
const note = z.string().trim().min(1);
const dates = {
    season: z.union([passSeasonId, z.string().regex(/^\d{4}$/)]),
    opensOn: date.optional(),
    closesOn: date.optional(),
    source,
    closingSource: source.optional(),
    note: note.optional(),
};

function datesFitSeason({ season, opensOn, closesOn, closingSource }: {
    season: string; opensOn?: string; closesOn?: string; closingSource?: string;
}) {
    const startYear = Number(season.slice(0, 4));
    const endYear = season.includes('/') ? startYear + 1 : startYear;
    return [opensOn, closesOn].some(Boolean) && [opensOn, closesOn].every(value => {
        if (!value) return true;
        const year = Number(value.slice(0, 4));
        return startYear <= year && year <= endYear;
    }) && (!opensOn || !closesOn || opensOn <= closesOn) && (!closingSource || Boolean(opensOn && closesOn));
}

const openingTerrain = z.strictObject({
    lifts: z.int().nonnegative().optional(),
    trails: z.int().nonnegative().optional(),
    acres: z.number().nonnegative().optional(),
    baseCm: z.number().nonnegative().optional(),
}).refine(values => Object.values(values).some(value => value !== undefined));

const actualSeason = z.strictObject({ ...dates, openingTerrain: openingTerrain.optional() })
    .refine(datesFitSeason, 'Use valid dates in season order')
    .refine(row => !row.openingTerrain || row.opensOn, 'Opening terrain requires a verified opening date');
const plannedSeason = z.strictObject(dates).refine(datesFitSeason, 'Use valid dates in season order');
const recurring = z.strictObject({ opensIn: month, closesIn: month, source, note: note.optional() });
const calendarSchema = z.strictObject({
    version: z.literal(1),
    checkedOn: date,
    sources: z.record(source, httpsUrl),
    areas: z.array(z.strictObject({
        areaId: skiId, recurring: recurring.optional(), actual: z.array(actualSeason).optional(), planned: z.array(plannedSeason).optional(),
    }).refine(row => row.recurring || row.actual?.length || row.planned?.length)),
});

const day = 86_400_000;
const referenceYear = Date.UTC(2000, 0, 1);
const daysInReferenceYear = 366;
const monthName = new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' });
const shortMonth = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' });
const monthDay = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });
export const seasonMonths = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, label: monthName.format(Date.UTC(2000, index, 1)) }));

export function readSeasonMonth(value: string | null) {
    return seasonMonths.find(option => String(option.month) === value)?.month;
}

type ActualSeason = z.infer<typeof actualSeason>;
type PlannedSeason = z.infer<typeof plannedSeason>;
type RecurringSeason = z.infer<typeof recurring>;
type CompletedSeason = { season: string; opensOn: string; closesOn: string };
type SeasonWindow = {
    opensIn: number; closesIn: number; opening: string; closing: string; openingRank: number; closingRank: number;
    spansYears: boolean; closingYearOffset: number;
    lengthDays?: number;
};
type TypicalSeason = SeasonWindow & {
    evidence: { count: number; latest: string } | { source: string; note?: string };
};
type AreaSeasons = { actual: ActualSeason[]; planned: PlannedSeason[]; typical?: TypicalSeason };

function roundedMedian(values: number[]) {
    values.sort((first, second) => first - second);
    const middle = Math.floor(values.length / 2);
    return values.length % 2 ? values[middle] : Math.round((values[middle - 1] + values[middle]) / 2);
}

function medianDate(rows: readonly CompletedSeason[], key: 'opensOn' | 'closesOn') {
    const median = roundedMedian(rows.map(row => {
        const [year, month, date] = row[key].split('-').map(Number);
        const ordinal = (Date.UTC(2000, month - 1, date) - referenceYear) / day;
        return (year - Number(row.season.slice(0, 4))) * daysInReferenceYear + ordinal;
    }));
    const date = new Date(referenceYear + (median % daysInReferenceYear) * day);
    return { month: date.getUTCMonth() + 1, label: monthDay.format(date), rank: date.getUTCMonth() * 32 + date.getUTCDate(),
        yearOffset: Math.floor(median / daysInReferenceYear) };
}

function typicalSeason(actual: readonly ActualSeason[], recurring: RecurringSeason | undefined, checkedOn: string): TypicalSeason | undefined {
    const cutoff = new Date(`${checkedOn}T00:00:00Z`);
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 5);
    const since = cutoff.toISOString().slice(0, 10);
    const recent = actual.flatMap(({ season, opensOn, closesOn }) =>
        opensOn && closesOn && closesOn >= since ? [{ season, opensOn, closesOn }] : []).slice(0, 5);
    if (recent.length >= 3) {
        const opening = medianDate(recent, 'opensOn');
        const closing = medianDate(recent, 'closesOn');
        const lengthDays = roundedMedian(recent.map(({ opensOn, closesOn }) =>
            (Date.parse(`${closesOn}T00:00:00Z`) - Date.parse(`${opensOn}T00:00:00Z`)) / day + 1));
        return {
            opensIn: opening.month, opening: opening.label, openingRank: opening.rank,
            closesIn: closing.month, closing: closing.label, closingRank: closing.rank,
            closingYearOffset: closing.yearOffset, spansYears: recent[0].season.includes('/'),
            lengthDays,
            evidence: { count: recent.length, latest: recent[0].season },
        };
    }
    if (recurring) {
        const { opensIn, closesIn, source, note } = recurring;
        const spansYears = opensIn > closesIn;
        return {
            opensIn, opening: shortMonth.format(Date.UTC(2000, opensIn - 1, 1)), openingRank: (opensIn - 1) * 32,
            closesIn, closing: shortMonth.format(Date.UTC(2000, closesIn - 1, 1)), closingRank: (closesIn - 1) * 32 + 31,
            closingYearOffset: Number(spansYears), spansYears,
            evidence: { source, note },
        };
    }
}

export function readSeasonCalendar(input: unknown, areas: readonly { id: string }[]) {
    const { sources, checkedOn, areas: entries } = calendarSchema.parse(input);
    const ids = new Set(areas.map(area => area.id));
    const byArea = new Map<string, AreaSeasons>();
    for (const row of entries) {
        if (!ids.has(row.areaId) || byArea.has(row.areaId)) throw Error(`Unknown or duplicate season area ${row.areaId}`);
        for (const records of [row.actual, row.planned]) {
            if (records && new Set(records.map(record => record.season)).size !== records.length) {
                throw Error(`Duplicate season for ${row.areaId}`);
            }
        }
        const actual = [...row.actual ?? []].sort((a, b) => b.season.localeCompare(a.season));
        const planned = [...row.planned ?? []].sort((a, b) => a.season.localeCompare(b.season));
        for (const item of actual) {
            if ((item.opensOn && item.opensOn > checkedOn) || (item.closesOn && item.closesOn > checkedOn)) {
                throw Error(`Historical dates are in the future for ${row.areaId}/${item.season}`);
            }
        }
        for (const item of [...actual, ...planned, ...row.recurring ? [row.recurring] : []]) {
            if (!Object.hasOwn(sources, item.source) || ('closingSource' in item && item.closingSource &&
                !Object.hasOwn(sources, item.closingSource))) throw Error(`Missing season source for ${row.areaId}`);
        }
        byArea.set(row.areaId, { actual, planned, typical: typicalSeason(actual, row.recurring, checkedOn) });
    }
    return { checkedOn, sources, byArea };
}

export const seasonCalendar = readSeasonCalendar(seasonData, skiAreas);

export function seasonViewDate(area: SkiArea, now?: number) {
    return now === undefined ? seasonCalendar.checkedOn : localSkiDate(now, area.location.timeZone ?? 'UTC');
}

export function upcomingSeasonPlan(entry: AreaSeasons | undefined, date: string, season?: string, reportedOpening?: string) {
    if (!entry) return;
    for (const plan of entry.planned) {
        if (season && plan.season !== season) continue;
        const actual = entry.actual.find(row => row.season === plan.season);
        if (actual?.closesOn) continue;
        const opensOn = plan.opensOn && plan.opensOn >= date && !actual?.opensOn ? plan.opensOn : undefined;
        const closesOn = plan.closesOn && plan.closesOn >= date ? plan.closesOn : undefined;
        if (reportedOpening && !datesFitSeason({ season: plan.season, opensOn: reportedOpening, closesOn })) continue;
        if (opensOn || closesOn) return { ...plan, opensOn, closesOn };
    }
}

export function reportedOpeningPlan(report: ResortReport | undefined, date: string, now?: number) {
    if (now !== undefined && report?.opensOn && report.opensOn >= date && isFreshReport(report, now)) {
        return { date: report.opensOn, source: report.source };
    }
}

type SeasonBoundary = { month: number; label: string; date?: string; basis: 'Recorded' | 'Scheduled' | 'Estimated'; source?: string };

function publishedSeasonWindow(area: SkiArea): SeasonWindow | undefined {
    if (!area.seasonWindow || /\d/.test(area.seasonWindow)) return;
    const names = area.seasonWindow.match(/[a-z]+/gi) ?? [];
    const months = names.flatMap(name => seasonMonths.filter(month => month.label.toLowerCase() === name.toLowerCase()));
    if (months.length !== 2) return;
    const [open, close] = months;
    const spansYears = open.month > close.month;
    return {
        opensIn: open.month, opening: open.label, openingRank: (open.month - 1) * 32,
        closesIn: close.month, closing: close.label, closingRank: (close.month - 1) * 32 + 31,
        closingYearOffset: Number(spansYears), spansYears,
    };
}

export function typicalSkiSeason(area: SkiArea, calendar = seasonCalendar) {
    const typical = calendar.byArea.get(area.id)?.typical;
    if (typical) {
        const { evidence } = typical;
        return { ...typical, source: 'source' in evidence ? calendar.sources[evidence.source] : undefined };
    }
    const published = publishedSeasonWindow(area);
    if (!published) return;
    const source = area.statSources?.find(group => group.fields.includes('seasonWindow'))?.source ?? area.statsUrl ?? area.website;
    return { ...published, evidence: undefined, source };
}

function seasonForDate(typical: SeasonWindow, date: string, actual: readonly ActualSeason[]) {
    const [year, month, day] = date.split('-').map(Number);
    const seasonEnded = (month - 1) * 32 + day > typical.closingRank;
    let firstYear = year - typical.closingYearOffset + Number(seasonEnded);
    const seasonAt = (start: number) => typical.spansYears ? `${start}/${String((start + 1) % 100).padStart(2, '0')}` : String(start);
    if (actual.some(row => row.season === seasonAt(firstYear) && row.closesOn && row.closesOn < date)) firstYear++;
    return seasonAt(firstYear);
}

function datedBoundary(date: string, basis: SeasonBoundary['basis'], source: string): SeasonBoundary {
    return { month: Number(date.slice(5, 7)), label: monthDay.format(Date.parse(`${date}T00:00:00Z`)), date, basis, source };
}

export function skiSeasonSchedule(area: SkiArea, date: string, conditions?: Conditions, calendar = seasonCalendar) {
    const entry = calendar.byArea.get(area.id);
    const actual = entry?.actual ?? [];
    const typical = typicalSkiSeason(area, calendar);
    const expectedSeason = typical && seasonForDate(typical, date, actual);
    const active = actual.find(row => row.opensOn && row.opensOn <= date && (row.closesOn ? row.closesOn >= date : row.season === expectedSeason));
    const announcement = active ? undefined : reportedOpeningPlan(conditions?.reports.get(area.id), date, conditions?.now);
    const scheduled = upcomingSeasonPlan(entry, date, active?.season, announcement?.date);
    const estimatedSeason = announcement && typical ? seasonForDate(typical, announcement.date, actual) : expectedSeason;
    const outlookSeason = active?.season ?? scheduled?.season ?? estimatedSeason;
    const lastRecorded = outlookSeason || announcement ? undefined : actual[0];
    const season = outlookSeason ?? lastRecorded?.season;
    const recorded = lastRecorded ?? actual.find(row => row.season === season);
    const reportedOpen = recorded?.opensOn ? undefined : announcement;
    return { season, typical, recorded, scheduled, reportedOpen, historical: lastRecorded !== undefined };
}

export function skiSeasonOutlook(area: SkiArea, date: string, conditions?: Conditions, calendar = seasonCalendar) {
    const { season, typical, recorded, scheduled, reportedOpen, historical } = skiSeasonSchedule(area, date, conditions, calendar);
    function boundary(edge: 'opening' | 'closing'): SeasonBoundary | undefined {
        const opening = edge === 'opening';
        const key = opening ? 'opensOn' : 'closesOn';
        const actualDay = recorded?.[key];
        if (recorded && actualDay) {
            return datedBoundary(actualDay, 'Recorded', calendar.sources[opening ? recorded.source : recorded.closingSource ?? recorded.source]);
        }
        if (opening && reportedOpen) return datedBoundary(reportedOpen.date, 'Scheduled', reportedOpen.source.url);
        const plannedDay = scheduled?.[key];
        if (scheduled && plannedDay) {
            return datedBoundary(plannedDay, 'Scheduled', calendar.sources[opening ? scheduled.source : scheduled.closingSource ?? scheduled.source]);
        }
        if (typical) return { month: opening ? typical.opensIn : typical.closesIn, label: typical[edge], basis: 'Estimated', source: typical.source };
    }
    const opening = boundary('opening');
    const closing = boundary('closing');
    return { season, opening, closing, note: scheduled?.note, historical, typical };
}

export function includesSeasonMonth(typical: Pick<SeasonWindow, 'opensIn' | 'closesIn'> | undefined, month: number) {
    if (!typical) return false;
    const offset = (month - typical.opensIn + 12) % 12;
    return offset <= (typical.closesIn - typical.opensIn + 12) % 12;
}
