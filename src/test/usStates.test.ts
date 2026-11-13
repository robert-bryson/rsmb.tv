import { describe, expect, it } from 'vitest';
import { usJurisdictions, usStates, usStatesAndDc, usStatesAndTerritories } from '../../shared/geography/usStates';

// Independent expected identities protect every generator from a registry typo.
const expectedStates = `AL|Alabama|01
AK|Alaska|02
AZ|Arizona|04
AR|Arkansas|05
CA|California|06
CO|Colorado|08
CT|Connecticut|09
DE|Delaware|10
FL|Florida|12
GA|Georgia|13
HI|Hawaii|15
ID|Idaho|16
IL|Illinois|17
IN|Indiana|18
IA|Iowa|19
KS|Kansas|20
KY|Kentucky|21
LA|Louisiana|22
ME|Maine|23
MD|Maryland|24
MA|Massachusetts|25
MI|Michigan|26
MN|Minnesota|27
MS|Mississippi|28
MO|Missouri|29
MT|Montana|30
NE|Nebraska|31
NV|Nevada|32
NH|New Hampshire|33
NJ|New Jersey|34
NM|New Mexico|35
NY|New York|36
NC|North Carolina|37
ND|North Dakota|38
OH|Ohio|39
OK|Oklahoma|40
OR|Oregon|41
PA|Pennsylvania|42
RI|Rhode Island|44
SC|South Carolina|45
SD|South Dakota|46
TN|Tennessee|47
TX|Texas|48
UT|Utah|49
VT|Vermont|50
VA|Virginia|51
WA|Washington|53
WV|West Virginia|54
WI|Wisconsin|55
WY|Wyoming|56`.split('\n').map(line => {
    const [abbr, name, fips] = line.split('|');
    return { abbr, name, fips };
});

describe('shared U.S. state identities', () => {
    it('preserves all 50 state identities, order, and leading-zero FIPS strings', () => {
        expect(usStates).toEqual(expectedStates);
    });

    it('provides the 50 states and DC without adding territories', () => {
        expect(usStatesAndDc).toEqual([
            ...expectedStates,
            { abbr: 'DC', name: 'District of Columbia', fips: '11' },
        ]);
    });

    it('preserves the existing tornado jurisdiction subset', () => {
        expect(usJurisdictions).toEqual([
            ...expectedStates,
            { abbr: 'DC', name: 'District of Columbia', fips: '11' },
            { abbr: 'PR', name: 'Puerto Rico', fips: '72' },
        ]);
    });

    it('adds each inhabited territory once without changing the existing subsets', () => {
        expect(usStatesAndTerritories).toEqual([
            ...usJurisdictions,
            { abbr: 'AS', name: 'American Samoa', fips: '60' },
            { abbr: 'GU', name: 'Guam', fips: '66' },
            { abbr: 'MP', name: 'Northern Mariana Islands', fips: '69' },
            { abbr: 'VI', name: 'United States Virgin Islands', fips: '78' },
        ]);
        expect(new Set(usStatesAndTerritories.map(state => state.fips)).size).toBe(56);
    });
});
