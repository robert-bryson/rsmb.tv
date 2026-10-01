import { describe, expect, it } from 'vitest';
import { airportCoordinates } from '../../projects/flights/scripts/airportCoordinates.js';

describe('airport CSV coordinates', () => {
    it.each([
        ['47.4502', '-122.3088', { lat: 47.4502, lon: -122.3088 }],
        [' 0 ', ' 0 ', { lat: 0, lon: 0 }],
        ['90', '180', { lat: 90, lon: 180 }],
        ['-90', '-180', { lat: -90, lon: -180 }],
    ])('accepts geographic coordinates %s, %s', (latitude_deg, longitude_deg, expected) => {
        expect(airportCoordinates({ latitude_deg, longitude_deg })).toEqual(expected);
    });

    it.each([
        ['', '0'], ['0', ' '], [' ', '0'],
        ['47north', '0'], ['0', '122west'],
        ['Infinity', '0'], ['0', '-Infinity'], ['NaN', '0'],
        ['90.01', '0'], ['-90.01', '0'], ['0', '180.01'], ['0', '-180.01'],
        [undefined, '0'], ['0', undefined], [null, '0'], ['0', 0],
    ])('rejects invalid coordinates %s, %s', (latitude_deg, longitude_deg) => {
        expect(airportCoordinates({ latitude_deg, longitude_deg })).toBeNull();
    });
});
