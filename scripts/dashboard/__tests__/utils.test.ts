import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { relativeTime, truncate, formatDuration } from '../utils.js';

describe('relativeTime', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-04-15T12:00:00Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns seconds for < 60s', () => {
        const date = new Date('2026-04-15T11:59:30Z');
        expect(relativeTime(date)).toBe('30s ago');
    });

    it('returns minutes for < 60m', () => {
        const date = new Date('2026-04-15T11:55:00Z');
        expect(relativeTime(date)).toBe('5m ago');
    });

    it('returns hours for < 24h', () => {
        const date = new Date('2026-04-15T09:00:00Z');
        expect(relativeTime(date)).toBe('3h ago');
    });

    it('returns days for >= 24h', () => {
        const date = new Date('2026-04-13T12:00:00Z');
        expect(relativeTime(date)).toBe('2d ago');
    });

    it('returns 0s ago for now', () => {
        const date = new Date('2026-04-15T12:00:00Z');
        expect(relativeTime(date)).toBe('0s ago');
    });
});

describe('truncate', () => {
    it('returns string unchanged when shorter than max', () => {
        expect(truncate('hello', 10)).toBe('hello');
    });

    it('returns string unchanged when exactly max length', () => {
        expect(truncate('hello', 5)).toBe('hello');
    });

    it('truncates and adds ellipsis when longer than max', () => {
        expect(truncate('hello world', 8)).toBe('hello w…');
    });

    it('handles max of 1', () => {
        expect(truncate('hello', 1)).toBe('…');
    });

    it('handles empty string', () => {
        expect(truncate('', 5)).toBe('');
    });
});

describe('formatDuration', () => {
    it('returns seconds for < 60s', () => {
        expect(formatDuration(0)).toBe('0s');
        expect(formatDuration(30_000)).toBe('30s');
        expect(formatDuration(59_999)).toBe('59s');
    });

    it('returns minutes for < 60m', () => {
        expect(formatDuration(60_000)).toBe('1m');
        expect(formatDuration(5 * 60_000)).toBe('5m');
        expect(formatDuration(59 * 60_000)).toBe('59m');
    });

    it('returns hours with remainder for < 24h', () => {
        expect(formatDuration(60 * 60_000)).toBe('1h');
        expect(formatDuration(90 * 60_000)).toBe('1h 30m');
        expect(formatDuration(3 * 60 * 60_000)).toBe('3h');
    });

    it('omits remainder minutes when zero', () => {
        expect(formatDuration(2 * 60 * 60_000)).toBe('2h');
    });

    it('returns days with hours for >= 24h', () => {
        expect(formatDuration(24 * 60 * 60_000)).toBe('1d 0h');
        expect(formatDuration(25 * 60 * 60_000)).toBe('1d 1h');
        expect(formatDuration(48 * 60 * 60_000)).toBe('2d 0h');
    });
});
