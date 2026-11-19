import { formatArea, formatElevation, type SkiUnits } from './browse';
import { passFamilySchema, passNames, type PassFamily, type SkiArea } from './catalog';
import { passIconSpacing } from './passIcons';

export const markerModes = {
    default: 'Resort dots',
    pass: 'Pass access',
    acres: 'Skiable area',
    verticalFt: 'Vertical drop',
    summitFt: 'Summit elevation',
    highestLiftTerminalFt: 'Highest lift terminal',
};

export type MarkerMode = keyof typeof markerModes;

export function readMarkerMode(value: string | null): MarkerMode {
    return value && Object.hasOwn(markerModes, value) ? value as MarkerMode : 'default';
}

interface LegendEntry { label: string; color: string; family?: PassFamily }
type MarkerAppearance = { color: string } & Partial<Record<PassFamily, number>>;

const defaultColor = '#67e8f9';
const unknown = { color: '#a1a1aa', label: 'Unknown' };
const passColors: Record<PassFamily, string> = {
    ikon: '#c084fc', epic: '#fb7185', indy: '#4ade80', 'mountain-collective': '#60a5fa',
};
const multiplePasses = { color: '#facc15', label: 'Multiple passes' };
const discountOnly = { color: '#fb923c', label: 'Discount only' };
const noRecordedPass = { color: unknown.color, label: 'No pass recorded' };
const numericColors = ['#bae6fd', '#38bdf8', '#818cf8', '#e879f9'] as const;
const thresholds = {
    acres: [250, 1_000, 2_500],
    verticalFt: [1_000, 2_000, 3_000],
    summitFt: [3_000, 6_000, 9_000],
    highestLiftTerminalFt: [3_000, 6_000, 9_000],
} as const;

export function markerLegend(mode: MarkerMode, units: SkiUnits): LegendEntry[] {
    if (mode === 'default') return [];
    if (mode === 'pass') {
        return [...passFamilySchema.options.map(family => ({ color: passColors[family], label: passNames[family], family })),
            multiplePasses, discountOnly, noRecordedPass];
    }
    const format = mode === 'acres' ? formatArea : formatElevation;
    const [low, middle, high] = thresholds[mode].map(value => format(value, units));
    const labels = [`Under ${low}`, `${low} to under ${middle}`, `${middle} to under ${high}`, `${high} and up`];
    return [...numericColors.map((color, index) => ({ color, label: labels[index] })), unknown];
}

export function markerAppearance(area: SkiArea, mode: MarkerMode): MarkerAppearance {
    if (mode === 'default') return { color: defaultColor };
    if (mode === 'pass') {
        const included = passFamilySchema.options.filter(family =>
            area.passes.some(pass => pass.family === family && pass.access === 'included'));
        if (!included.length) return { color: area.passes.length ? discountOnly.color : noRecordedPass.color };

        const midpoint = (included.length - 1) / 2;
        const offsets = Object.fromEntries(included.map((family, index) => [family, (index - midpoint) * passIconSpacing]));
        return { color: included.length > 1 ? multiplePasses.color : passColors[included[0]], ...offsets };
    }
    const value = area[mode];
    if (value === undefined) return { color: unknown.color };
    const cutoffs = thresholds[mode];
    if (mode === 'acres' && area.acresQualifier === 'lower-bound' && value < cutoffs[2]) return { color: unknown.color };
    return { color: numericColors[cutoffs.filter(cutoff => value >= cutoff).length] };
}
