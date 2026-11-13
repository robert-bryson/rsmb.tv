import { usStatesAndTerritories } from '../../../shared/geography/usStates';
import { pinCountryCode, pinStateFips, WORLD_COUNTRY_LOOKUP, type MapPin } from '../../../shared/worldPins';

export interface PinScope { countryCode: string; stateFips: string }
export interface PinBreadcrumb { label: string; scope: PinScope }
export const WORLD_SCOPE: PinScope = { countryCode: 'ALL', stateFips: '' };
const STATES = new Map<string, (typeof usStatesAndTerritories)[number]>(usStatesAndTerritories.map(state => [state.fips, state]));

export function isDescendantPin(parent: MapPin, child: MapPin) {
    return parent.level === 'country' ? child.level !== 'country' && pinCountryCode(parent) === pinCountryCode(child)
        : parent.level === 'state' && child.level === 'county' && pinStateFips(parent) === pinStateFips(child);
}

export function rankingAfterNavigation(previous: 'country' | 'state' | 'county', scope: PinScope, selectedId: string | null) {
    if (selectedId) return selectedId.startsWith('county-') ? 'county' : 'state';
    if (scope.countryCode === 'ALL') return 'country';
    if (!scope.stateFips) return 'state';
    return previous === 'country' ? 'county' : previous;
}

/** A shared county link has a state parent even before its data finishes loading. */
export function resolveStateScope(countryCode: string, selectedId: string | null, requested: string | null) {
    if (countryCode !== 'USA' || selectedId === 'country-US') return '';
    const inferred = /^(?:state-(\d{2})|county-(\d{2})\d{3})$/.exec(selectedId ?? '');
    const fips = inferred ? inferred[1] ?? inferred[2] : requested ?? '';
    return STATES.has(fips) ? fips : '';
}

export function parentPinScope(scope: PinScope, selected: MapPin | null): PinScope | null {
    if (selected?.level === 'county') return { countryCode: 'USA', stateFips: pinStateFips(selected) };
    if (selected?.level === 'state' || (!selected && scope.stateFips)) return { countryCode: scope.countryCode, stateFips: '' };
    return scope.countryCode === 'ALL' ? null : WORLD_SCOPE;
}

export function pinScopeName(scope: PinScope) {
    return scope.countryCode === 'ALL' ? 'world overview'
        : STATES.get(scope.stateFips)?.name ?? WORLD_COUNTRY_LOOKUP.get(scope.countryCode)!.name;
}

export function pinBreadcrumbs(scope: PinScope, selected: MapPin | null): PinBreadcrumb[] {
    const trail: PinBreadcrumb[] = [{ label: 'World', scope: WORLD_SCOPE }];
    if (scope.countryCode === 'ALL') return trail;
    trail.push({ label: WORLD_COUNTRY_LOOKUP.get(scope.countryCode)!.name, scope: { countryCode: scope.countryCode, stateFips: '' } });
    if (scope.stateFips) trail.push({ label: STATES.get(scope.stateFips)!.name, scope });
    if (selected?.level === 'county' || (selected?.level === 'state' && pinCountryCode(selected) !== 'USA')) {
        trail.push({ label: selected.name, scope });
    }
    return trail;
}

/** Change only geographic parameters; retain unrelated URL context. */
export function scopeSearchParams(previous: URLSearchParams, scope: PinScope, selected: MapPin | null = null) {
    const next = new URLSearchParams(previous);
    next.delete('pin'); next.delete('state'); next.delete('country');
    if (scope.countryCode !== 'USA') next.set('country', scope.countryCode);
    if (scope.stateFips) next.set('state', scope.stateFips);
    if (selected) next.set('pin', selected.id);
    return next;
}
