import { formatArea, formatElevation, matchesSkiPass, selectedSkiPasses, type SkiPassSelection, type SkiUnits } from './browse';
import { passFamilySchema, passNames, type PassFamily, type SkiArea } from './catalog';
import { skiDayStatus, statusLabels, type Conditions, type ResortStatus } from './conditions';

export const markerModes = {
    default: 'Resort icons',
    pass: 'Pass access',
    operatingStatus: 'Operating status',
    acres: 'Skiable area',
    verticalFt: 'Vertical drop',
    summitFt: 'Summit elevation',
    highestLiftTerminalFt: 'Highest lift terminal',
};

export type MarkerMode = keyof typeof markerModes;

export function readMarkerMode(value: string | null): MarkerMode {
    return value && Object.hasOwn(markerModes, value) ? value as MarkerMode : 'default';
}

interface LegendEntry { label: string; color: string; family?: PassFamily; multiple?: boolean; glyph?: string }
type MarkerAppearance = { color: string; passBadge?: ReturnType<typeof passBadgeId> };

export const resortMarkerColor = '#67e8f9';
const unknown = { color: '#a1a1aa', label: 'Unknown' };
export const statusMarkers: Record<ResortStatus, { color: string; glyph: string }> = {
    open: { color: '#78e5ad', glyph: '✓' }, limited: { color: '#f0c478', glyph: '◆' },
    'temporarily-closed': { color: '#f89a9b', glyph: '−' }, 'season-closed': { color: '#d9b2f6', glyph: '×' },
    unknown: { color: '#abb9c6', glyph: '○' },
};
export const passBadgeSize = 26;
export const passBadgeTextColor = '#141414';
export const multiplePassColor = '#facc15';
export const passColors: Record<PassFamily, string> = {
    ikon: '#c084fc', epic: '#fb7185', indy: '#4ade80', 'mountain-collective': '#60a5fa',
};
const discountOnly = { color: '#fb923c', label: 'Discount only' };
const indyDiscount = { ...discountOnly, label: 'Indy discount' };
const unconfirmedPass = { color: unknown.color, label: 'No confirmed access' };
const numericColors = ['#bae6fd', '#38bdf8', '#818cf8', '#e879f9'] as const;
const thresholds = {
    acres: [250, 1_000, 2_500],
    verticalFt: [1_000, 2_000, 3_000],
    summitFt: [3_000, 6_000, 9_000],
    highestLiftTerminalFt: [3_000, 6_000, 9_000],
} as const;

export function markerLegend(mode: MarkerMode, units: SkiUnits, indyDiscounts = false): LegendEntry[] {
    if (mode === 'default') return [];
    if (mode === 'operatingStatus') return (Object.keys(statusLabels) as ResortStatus[]).map(status => ({
        ...statusMarkers[status], label: status === 'unknown' ? 'No current status' : statusLabels[status],
    }));
    if (mode === 'pass') {
        if (indyDiscounts) return [indyDiscount];
        return [...passFamilySchema.options.map(family => ({ color: passColors[family], label: passNames[family], family })),
            { color: multiplePassColor, label: 'Multiple passes', multiple: true }, discountOnly, unconfirmedPass];
    }
    const format = mode === 'acres' ? formatArea : formatElevation;
    const [low, middle, high] = thresholds[mode].map(value => format(value, units));
    const labels = [`Under ${low}`, `${low} to under ${middle}`, `${middle} to under ${high}`, `${high} and up`];
    return [...numericColors.map((color, index) => ({ color, label: labels[index] })), unknown];
}

export function passBadgeId(family: PassFamily, multiple: boolean) {
    return multiple ? `${family}-plus` as const : family;
}

export function passAccessAppearance(area: SkiArea, selection?: SkiPassSelection): LegendEntry {
    const included = passFamilySchema.options.filter(family =>
        area.passes.some(pass => pass.family === family && pass.access === 'included'));
    const passes = selectedSkiPasses(selection);
    const preferred = included.find(family => passes.includes(family) && matchesSkiPass(area, family, selection?.product));
    if (!preferred && passes.includes('indy-discounts') && matchesSkiPass(area, 'indy-discounts')) return indyDiscount;
    const family = preferred ?? included[0];
    if (!family) return area.passes.some(pass => pass.access === 'discount') ? discountOnly : unconfirmedPass;
    const multiple = included.length > 1;
    return { color: multiple ? multiplePassColor : passColors[family], label: passNames[family], family, multiple };
}

export function markerAppearance(area: SkiArea, mode: MarkerMode, passSelection?: SkiPassSelection, conditions?: Conditions): MarkerAppearance {
    if (mode === 'default') return { color: resortMarkerColor };
    if (mode === 'operatingStatus') return { color: statusMarkers[skiDayStatus(conditions?.reports.get(area.id), conditions?.now ?? 0, area.location.timeZone)].color };
    if (mode === 'pass') {
        const { color, family, multiple } = passAccessAppearance(area, passSelection);
        return family ? { color, passBadge: passBadgeId(family, Boolean(multiple)) } : { color };
    }
    const value = area[mode];
    if (value === undefined) return { color: unknown.color };
    const cutoffs = thresholds[mode];
    if (mode === 'acres' && area.acresQualifier === 'lower-bound' && value < cutoffs[2]) return { color: unknown.color };
    return { color: numericColors[cutoffs.filter(cutoff => value >= cutoff).length] };
}
