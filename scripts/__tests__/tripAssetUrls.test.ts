// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { localTripAssetSrcSet, localTripAssetUrl, localTripPhoto } from '../../shared/tripAssetUrls';

describe('local trip asset URLs', () => {
    it.each([
        ['https://data.rsmb.tv/trips/coast/photos/camp.webp', '/data/trips/coast/photos/camp.webp'],
        ['https://data.rsmb.tv/trips/coast/geo/route.geojson', '/data/trips/coast/geo/route.geojson'],
        ['https://data.rsmb.tv.example/trips/coast/camp.jpg', 'https://data.rsmb.tv.example/trips/coast/camp.jpg'],
        ['https://example.com/camp.jpg?source=https://data.rsmb.tv/trips/coast/camp.jpg', 'https://example.com/camp.jpg?source=https://data.rsmb.tv/trips/coast/camp.jpg'],
        ['https://data.rsmb.tv/other/camp.jpg', 'https://data.rsmb.tv/other/camp.jpg'],
        ['/test-trip/camp.svg', '/test-trip/camp.svg'],
    ])('maps only the CDN trip mirror: %s', (input, expected) => {
        expect(localTripAssetUrl(input)).toBe(expected);
        expect(localTripAssetSrcSet(`${input} 1600w`)).toBe(`${expected} 1600w`);
    });

    it('maps each candidate while preserving its descriptor and whitespace', () => {
        const input = ' https://data.rsmb.tv/trips/coast/camp-480.webp 480w,\n https://data.rsmb.tv/trips/coast/camp-1600.webp 1600w';
        expect(localTripAssetSrcSet(input))
            .toBe(' /data/trips/coast/camp-480.webp 480w,\n /data/trips/coast/camp-1600.webp 1600w');
        expect(localTripAssetSrcSet(undefined)).toBeUndefined();
    });

    it('maps page and viewer sources without changing authored data or mutating the manifest', () => {
        const photo = {
            id: 'camp', alt: 'A tent by the lake.', caption: 'First night.', width: 1600, height: 1000,
            src: 'https://data.rsmb.tv/trips/coast/camp-1600.webp',
            srcSet: 'https://data.rsmb.tv/trips/coast/camp-480.webp 480w, https://data.rsmb.tv/trips/coast/camp-1600.webp 1600w',
            full: { src: 'https://data.rsmb.tv/trips/coast/camp-full.jpg', width: 6000, height: 3750,
                srcSet: 'https://data.rsmb.tv/trips/coast/camp-view-1600.jpg 1600w, https://data.rsmb.tv/trips/coast/camp-full.jpg 6000w' },
        };
        const original = structuredClone(photo);
        const local = localTripPhoto(photo);
        expect(local).toMatchObject({ id: photo.id, alt: photo.alt, caption: photo.caption,
            src: '/data/trips/coast/camp-1600.webp',
            srcSet: '/data/trips/coast/camp-480.webp 480w, /data/trips/coast/camp-1600.webp 1600w',
            full: { src: '/data/trips/coast/camp-full.jpg',
                srcSet: '/data/trips/coast/camp-view-1600.jpg 1600w, /data/trips/coast/camp-full.jpg 6000w' } });
        expect(photo).toEqual(original);
        expect(localTripPhoto({ ...photo, full: undefined }).full).toBeUndefined();
        expect(localTripPhoto({ ...photo, full: { ...photo.full, srcSet: undefined } }).full?.srcSet).toBeUndefined();
    });
});
