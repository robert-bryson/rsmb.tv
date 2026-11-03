import { describe, expect, it } from 'vitest';
import { usJurisdictions, usStates, usStatesAndDc } from '../../shared/geography/usStates';

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

    it('includes DC only for flight boundaries and tornado normalization', () => {
        expect(usStatesAndDc).toEqual([
            ...expectedStates,
            { abbr: 'DC', name: 'District of Columbia', fips: '11' },
        ]);
    });

    it('includes Puerto Rico only for tornado normalization', () => {
        expect(usJurisdictions).toEqual([
            ...expectedStates,
            { abbr: 'DC', name: 'District of Columbia', fips: '11' },
            { abbr: 'PR', name: 'Puerto Rico', fips: '72' },
        ]);
    });
});
