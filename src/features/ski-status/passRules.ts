import { z } from 'zod';
import { passFamilySchema, skiAreas, type SkiArea } from './catalog';
import { httpsUrl, passSeasonId, skiId } from './schemas';

const date = z.iso.date();
const dateRange = z.tuple([date, date]).refine(([start, end]) => start <= end, 'Use dates in order');
const dayCount = z.int().positive();
const ruleSchema = z.strictObject({
    areaId: skiId,
    products: z.array(skiId).min(1),
    access: z.enum(['included', 'discount', 'excluded']),
    days: z.union([dayCount, z.literal('unlimited')]).optional(),
    shared: z.string().min(1).optional(),
    validDates: z.array(dateRange).min(1).optional(),
    blackouts: z.array(dateRange).optional(),
    weekdays: z.array(z.int().min(0).max(6)).min(1).optional(),
    consecutiveDays: z.literal(true).optional(),
    lodgingRequired: z.literal(true).optional(),
    reservation: z.enum(['required', 'none', 'check']).optional(),
    note: z.string().min(1).optional(),
    source: httpsUrl,
    checkedOn: date,
});
const rulesFileSchema = z.strictObject({
    season: passSeasonId,
    family: passFamilySchema,
    seasonDates: dateRange,
    products: z.array(z.strictObject({
        id: skiId, name: z.string().min(1), totalDays: dayCount.optional(), requiresHomeArea: z.literal(true).optional(),
    })).min(1),
    rules: z.array(ruleSchema).min(1),
});

type PassRule = z.infer<typeof ruleSchema>;
type Product = z.infer<typeof rulesFileSchema>['products'][number];
type Season = { dates: [string, string]; rules: ReadonlyMap<string, PassRule>; totalDays?: number };
export type PassProduct = Omit<Product, 'totalDays'> & { family: z.infer<typeof passFamilySchema>; seasons: readonly Season[] };

export function readPassRules(inputs: readonly unknown[], areas: readonly SkiArea[]) {
    const areasById = new Map(areas.map(area => [area.id, area]));
    const products = new Map<string, PassProduct>();
    const files = new Set<string>();
    for (const input of inputs) {
        const file = rulesFileSchema.parse(input);
        const key = `${file.family}/${file.season}`;
        if (files.has(key)) throw Error(`Duplicate pass rules for ${key}`);
        files.add(key);
        const startYear = Number(file.season.slice(0, 4));
        if (Number(file.seasonDates[0].slice(0, 4)) !== startYear || Number(file.seasonDates[1].slice(0, 4)) !== startYear + 1) {
            throw Error(`Dates do not match pass season ${key}`);
        }
        const byProduct = new Map(file.products.map(product => [product.id, {
            ...product, rules: new Map<string, PassRule>(), allowances: new Map<string, number>(),
        }]));
        if (byProduct.size !== file.products.length) throw Error(`Duplicate pass product in ${key}`);
        for (const rule of file.rules) {
            const area = areasById.get(rule.areaId);
            if (!area?.location.timeZone) throw Error(`Pass rule requires an area and time zone for ${rule.areaId}`);
            if ([...rule.validDates ?? [], ...rule.blackouts ?? []].some(range => range.some(day => !includesDate(file.seasonDates, day)))) {
                throw Error(`Rule dates fall outside ${key} for ${rule.areaId}`);
            }
            if (rule.consecutiveDays && (typeof rule.days !== 'number' || rule.days < 2)) {
                throw Error(`Consecutive days require a limit of at least two days for ${rule.areaId}`);
            }
            if (rule.access === 'excluded' && (rule.days !== undefined || rule.reservation || rule.blackouts || rule.weekdays || rule.lodgingRequired)) {
                throw Error(`Excluded access has conflicting terms for ${rule.areaId}`);
            }
            for (const id of rule.products) {
                const product = byProduct.get(id);
                if (!product || product.rules.has(rule.areaId)) throw Error(`Invalid or duplicate pass rule for ${id}/${rule.areaId}`);
                if (rule.access === 'included' && rule.days === undefined && !product.totalDays) {
                    throw Error(`Missing day allowance for ${id}/${rule.areaId}`);
                }
                if (rule.shared) {
                    if (typeof rule.days !== 'number') throw Error(`Shared allowance requires a day limit for ${rule.areaId}`);
                    const allowance = product.allowances.get(rule.shared);
                    if (allowance !== undefined && allowance !== rule.days) throw Error(`Conflicting shared allowance for ${id}/${rule.shared}`);
                    product.allowances.set(rule.shared, rule.days);
                }
                product.rules.set(rule.areaId, rule);
            }
        }
        for (const { id, name, totalDays, requiresHomeArea, rules } of byProduct.values()) {
            if (!rules.size) throw Error(`Product has no verified rules for ${key}/${id}`);
            const previous = products.get(id);
            const dates = file.seasonDates;
            if (previous && previous.family !== file.family) throw Error(`Conflicting pass family for ${id}`);
            if (previous && previous.requiresHomeArea !== requiresHomeArea) throw Error(`Conflicting home area requirement for ${id}`);
            products.set(id, {
                id, name: previous && previous.seasons[0].dates[0] > dates[0] ? previous.name : name,
                family: file.family, requiresHomeArea,
                seasons: [...previous?.seasons ?? [], { dates, rules, totalDays }]
                    .sort((first, second) => second.dates[0].localeCompare(first.dates[0])),
            });
        }
    }
    return products;
}

const files = import.meta.glob('../../../projects/ski-status/data/pass-rules/*.json', { eager: true, import: 'default' });
export const passProducts = readPassRules(Object.values(files), skiAreas);

const formatters = new Map<string, Intl.DateTimeFormat>();
export function localSkiDate(now: number, timeZone: string) {
    let formatter = formatters.get(timeZone);
    if (!formatter) {
        formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
        formatters.set(timeZone, formatter);
    }
    const parts = formatter.formatToParts(now);
    return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-');
}

export function readSkiDate(value: string | null) {
    return date.safeParse(value).data;
}

function includesDate([start, end]: [string, string], day: string) {
    return start <= day && day <= end;
}

export const accessLabels = {
    included: 'Included access', discount: 'Discount only', excluded: 'Excluded product',
    blackout: 'Blackout date', 'outside-dates': 'Outside access dates', unknown: 'Access unverified',
    'home-area': 'Home area excluded', 'home-area-required': 'Select your home ski area',
    'lodging-required': 'Lodging required for access',
} as const;

export function matchesPassProduct(status: keyof typeof accessLabels) {
    return status === 'included' || status === 'discount' || status === 'home-area-required' || status === 'lodging-required';
}

export function evaluatePass(product: PassProduct, area: SkiArea, now: number, skiDate?: string, homeAreaId?: string): {
    date?: string; status: keyof typeof accessLabels; rule?: PassRule; totalDays?: number;
} {
    const day = skiDate ?? (area.location.timeZone && localSkiDate(now, area.location.timeZone));
    if (!day) return { status: 'unknown' };
    const seasons = product.seasons.filter(({ dates }) => includesDate(dates, day));
    const season = seasons.find(({ rules }) => {
        const rule = rules.get(area.id);
        return rule && (!rule.validDates || rule.validDates.some(range => includesDate(range, day)));
    }) ?? seasons[0];
    const rule = season?.rules.get(area.id);
    if (!season) return { date: day, status: 'outside-dates' };
    if (!rule) return { date: day, status: 'unknown' };
    const details = { date: day, rule, totalDays: season.totalDays };
    if (rule.validDates && !rule.validDates.some(range => includesDate(range, day))) return { ...details, status: 'outside-dates' };
    if (rule.blackouts?.some(range => includesDate(range, day)) ||
        (rule.weekdays && !rule.weekdays.includes(new Date(`${day}T00:00:00Z`).getUTCDay()))) return { ...details, status: 'blackout' };
    if (product.requiresHomeArea && rule.access !== 'excluded') {
        if (!homeAreaId) return { ...details, status: 'home-area-required' };
        if (homeAreaId === area.id) return { ...details, status: 'home-area' };
    }
    return { ...details, status: rule.lodgingRequired ? 'lodging-required' : rule.access };
}
