// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isDescendantPin, parentPinScope, pinBreadcrumbs, rankingAfterNavigation, resolveStateScope, scopeSearchParams, WORLD_SCOPE } from '../../src/features/pins/navigation';
import { circlePeers, contextPinIds, visibleMapPins } from '../../src/features/pins/presentation';
import { colorado, fallsChurch, national, publishedPins } from './pinsFixtures';
import { parseWorldRegionPins, worldPinsDataSchema } from '../../shared/worldPins';
import { readPinsArtifact } from './pinsFixtures';

const countries = worldPinsDataSchema.parse(readPinsArtifact('world/pins.json')).pins;
const canada = countries.find(pin => pin.id === 'country-CAN')!;
const ontario = parseWorldRegionPins(readPinsArtifact('world/regions/CAN.json'), 'CAN').pins.find(pin => pin.name === 'Ontario')!;
const virginia = publishedPins.pins.find(pin => pin.id === 'state-51')!;

describe('geographic parent navigation', () => {
    it('retains the chosen ranking within a state and restores appropriate ranks when moving between levels', () => {
        const state = { countryCode: 'USA', stateFips: '08' };
        expect(rankingAfterNavigation('state', state, null)).toBe('state');
        expect(rankingAfterNavigation('county', state, null)).toBe('county');
        expect(rankingAfterNavigation('country', state, null)).toBe('county');
        expect(rankingAfterNavigation('county', { countryCode: 'USA', stateFips: '' }, null)).toBe('state');
        expect(rankingAfterNavigation('state', WORLD_SCOPE, null)).toBe('country');
        expect(rankingAfterNavigation('state', state, fallsChurch.id)).toBe('county');
        expect(rankingAfterNavigation('county', state, colorado.id)).toBe('state');
    });
    it('distinguishes child jurisdictions from siblings and other countries', () => {
        expect(isDescendantPin(national, colorado)).toBe(true);
        expect(isDescendantPin(national, fallsChurch)).toBe(true);
        expect(isDescendantPin(canada, colorado)).toBe(false);
        expect(isDescendantPin(national, canada)).toBe(false);
        expect(isDescendantPin(virginia, fallsChurch)).toBe(true);
        expect(isDescendantPin(colorado, fallsChurch)).toBe(false);
        expect(isDescendantPin(colorado, virginia)).toBe(false);
        expect(isDescendantPin(fallsChurch, virginia)).toBe(false);
    });
    it('moves counties to their state, regions to their country, and countries to the world', () => {
        expect(parentPinScope({ countryCode: 'USA', stateFips: '51' }, fallsChurch)).toEqual({ countryCode: 'USA', stateFips: '51' });
        expect(parentPinScope({ countryCode: 'USA', stateFips: '08' }, colorado)).toEqual({ countryCode: 'USA', stateFips: '' });
        expect(parentPinScope({ countryCode: 'CAN', stateFips: '' }, ontario)).toEqual({ countryCode: 'CAN', stateFips: '' });
        expect(parentPinScope({ countryCode: 'USA', stateFips: '' }, national)).toEqual(WORLD_SCOPE);
        expect(parentPinScope({ countryCode: 'CAN', stateFips: '' }, canada)).toEqual(WORLD_SCOPE);
        expect(parentPinScope({ countryCode: 'USA', stateFips: '51' }, null)).toEqual({ countryCode: 'USA', stateFips: '' });
        expect(parentPinScope({ countryCode: 'CAN', stateFips: '' }, null)).toEqual(WORLD_SCOPE);
        expect(parentPinScope(WORLD_SCOPE, null)).toBeNull();
    });

    it('infers valid U.S. parents from shared links and rejects stale or invalid scopes', () => {
        expect(resolveStateScope('USA', 'county-51610', null)).toBe('51');
        expect(resolveStateScope('USA', 'state-08', '51')).toBe('08');
        expect(resolveStateScope('USA', 'country-US', '08')).toBe('');
        expect(resolveStateScope('USA', null, '66')).toBe('66');
        expect(resolveStateScope('USA', null, '99')).toBe('');
        expect(resolveStateScope('CAN', null, '08')).toBe('');
        expect(resolveStateScope('USA', 'county-99999', null)).toBe('');
    });

    it('makes a complete location trail and keeps unrelated query parameters', () => {
        const scope = { countryCode: 'USA', stateFips: '51' };
        expect(pinBreadcrumbs(scope, fallsChurch).map(crumb => crumb.label)).toEqual(['World', 'United States', 'Virginia', 'Falls Church city']);
        expect(pinBreadcrumbs(scope, null).map(crumb => crumb.label)).toEqual(['World', 'United States', 'Virginia']);
        expect(pinBreadcrumbs({ countryCode: 'CAN', stateFips: '' }, ontario).map(crumb => crumb.label)).toEqual(['World', 'Canada', 'Ontario']);
        expect(pinBreadcrumbs(WORLD_SCOPE, null)).toHaveLength(1);
        const query = new URLSearchParams('country=CAN&pin=region-CAN-682&state=08&keep=1');
        expect(scopeSearchParams(query, scope).toString()).toBe('keep=1&state=51');
        expect(scopeSearchParams(query, WORLD_SCOPE).toString()).toBe('keep=1&country=ALL');
        expect(scopeSearchParams(query, scope, fallsChurch).get('pin')).toBe(fallsChurch.id);
        expect(query.get('country')).toBe('CAN');
    });
});

describe('focus with geographic context', () => {
    it('retains neighboring state and country pins but excludes counties outside the chosen state', () => {
        const pins = visibleMapPins([national, colorado, virginia, fallsChurch], [canada, national], '51');
        expect(pins.map(pin => pin.id)).toEqual([national.id, colorado.id, virginia.id, fallsChurch.id, canada.id]);
        expect(visibleMapPins([national, fallsChurch], [], '08').map(pin => pin.id)).toEqual([national.id]);
        const context = contextPinIds(pins, [canada], '51', null);
        expect([...context]).toEqual([national.id, colorado.id, canada.id]);
        expect(circlePeers(pins, context, null)).toEqual([virginia, fallsChurch]);
    });

    it('mutes other selectable pins and limits comparison circles to the selected geographic level', () => {
        const pins = [national, colorado, virginia, fallsChurch, canada];
        const context = contextPinIds(pins, [canada], '08', colorado);
        expect(context.has(colorado.id)).toBe(false);
        expect(context.size).toBe(4);
        expect(circlePeers(pins, context, colorado)).toEqual([colorado, virginia]);
        expect(circlePeers(pins, contextPinIds(pins, [], '', national), national)).toEqual([national, canada]);
    });
});
