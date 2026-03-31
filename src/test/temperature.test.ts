import { describe, it, expect } from 'vitest';
import { fToC, formatTemp } from '../features/temperatures/utils/temperature';

describe('fToC', () => {
    it('converts 32°F to 0°C', () => {
        expect(fToC(32)).toBeCloseTo(0);
    });

    it('converts 212°F to 100°C', () => {
        expect(fToC(212)).toBeCloseTo(100);
    });

    it('converts -40°F to -40°C', () => {
        expect(fToC(-40)).toBeCloseTo(-40);
    });

    it('converts 72°F to 22.2°C', () => {
        expect(fToC(72)).toBeCloseTo(22.222, 2);
    });

    it('converts 0°F to -17.8°C', () => {
        expect(fToC(0)).toBeCloseTo(-17.778, 2);
    });
});

describe('formatTemp', () => {
    it('formats Fahrenheit', () => {
        expect(formatTemp(72, false)).toBe('72°F');
    });

    it('formats Celsius', () => {
        expect(formatTemp(32, true)).toBe('0.0°C');
    });

    it('formats 212°F as Celsius', () => {
        expect(formatTemp(212, true)).toBe('100.0°C');
    });

    it('formats negative temps in Celsius', () => {
        expect(formatTemp(-40, true)).toBe('-40.0°C');
    });

    it('shows one decimal place in Celsius', () => {
        expect(formatTemp(72, true)).toBe('22.2°C');
    });
});
