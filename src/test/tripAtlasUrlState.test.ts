import { describe, expect, it } from 'vitest';
import { encodeAtlasCamera, readAtlasCamera, readAtlasPresentation } from '../features/trips/atlas/tripAtlasUrlState';

describe('shareable atlas views', () => {
    it('round-trips every camera axis at stable precision', () => {
        const encoded = encodeAtlasCamera({ center: [-123.123456789, 48.23456789], zoom: 7.123456, bearing: -22.126, pitch: 35.678 });
        expect(encoded).toBe('-123.123457,48.234568,7.1235,-22.13,35.68');
        expect(readAtlasCamera(encoded!)).toEqual({ center: [-123.123457, 48.234568], zoom: 7.1235, bearing: -22.13, pitch: 35.68 });
        expect(encodeAtlasCamera(readAtlasCamera(encoded!)!)).toBe(encoded);
    });

    it.each([180, -180, 540, -540, 179.99999999])('canonicalizes world copies and the dateline without oscillating: %s', lng => {
        const encoded = encodeAtlasCamera({ center: [lng, 0], zoom: 0, bearing: 540, pitch: 0 });
        expect(encoded).toBe('-180,0,0,-180,0');
        expect(encodeAtlasCamera(readAtlasCamera(encoded!)!)).toBe(encoded);
    });

    it.each([null, '', ',0,1,0,0', '0,0,1,0', '0,0,1,0,0,extra', 'NaN,0,1,0,0', '0x10,0,1,0,0',
        '181,0,1,0,0', '0,91,1,0,0', '0,0,23,0,0', '0,0,-3,0,0', '0,0,1,181,0', '0,0,1,0,61', '0,0,1,0,-1', '0,0,Infinity,0,0',
    ])('ignores an invalid camera as one complete value: %s', value => {
        expect(readAtlasCamera(value)).toBeUndefined();
    });

    it('rejects non-finite renderer values rather than putting them in a link', () => {
        expect(encodeAtlasCamera({ center: [Infinity, 0], zoom: 3, bearing: 0, pitch: 0 })).toBeUndefined();
        expect(encodeAtlasCamera({ center: [0, 0], zoom: 3, bearing: NaN, pitch: 0 })).toBeUndefined();
    });

    it('accepts only known presentation values', () => {
        expect(readAtlasPresentation(new URLSearchParams('panel=expanded&results=table'))).toEqual({ panel: 'expanded', results: 'table' });
        expect(readAtlasPresentation(new URLSearchParams('panel=collapsed&results=cards'))).toEqual({ panel: 'collapsed', results: 'cards' });
        expect(readAtlasPresentation(new URLSearchParams('panel=compact&results=bad'))).toEqual({ panel: 'compact', results: undefined });
        expect(readAtlasPresentation(new URLSearchParams('panel=constructor&results=__proto__'))).toEqual({ panel: undefined, results: undefined });
    });
});
