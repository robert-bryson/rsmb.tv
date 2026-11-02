import { describe, expect, it } from 'vitest';
import { parseCSV, runQAQC, toCSV } from '../sync-flights.js';

describe('flight Sheet ingestion', () => {
    it('round trips quoted notes with each CSV line-break form', () => {
        const rows = [['date', 'notes'], ['1/1/2024', 'first\rsecond'], ['1/2/2024', 'first\nsecond'], ['1/3/2024', 'first\r\nsecond, "quoted"']];
        expect(parseCSV(toCSV(rows))).toEqual(rows);
    });

    it('normalizes optional column aliases and ISO dates before CSV conversion', () => {
        const result = runQAQC(parseCSV('date,airline,origin,destination,Flight Number,Duration Minutes,Duration_Kind,Duration Source\n2024-02-29,United Airlines,sea,lax,ua123,165,actual-block,manual'));
        expect(result.errors).toEqual([]);
        expect(result.rows).toEqual([
            ['date', 'airline', 'origin', 'destination', 'flightNumber', 'durationMinutes', 'durationKind', 'durationSource'],
            ['2/29/2024', 'United', 'SEA', 'LAX', 'UA123', '165', 'actual-block', 'manual'],
        ]);
    });

    it('rejects duplicate normalized headers and mismatched widths', () => {
        expect(runQAQC([['date', 'airline', 'origin', 'destination', 'Duration Minutes', 'duration_minutes'], ['1/1/2024', 'United', 'SEA', 'LAX', '', '']]).errors).toContainEqual(expect.stringContaining('Duplicate columns'));
        expect(runQAQC([['date', 'airline', 'origin', 'destination'], ['1/1/2024', 'United', 'SEA', 'LAX', 'extra']]).errors).toContain('Row 2: Incorrect number of columns');
    });

    it('preserves quoted multiline notes and optional duration fields', () => {
        const rows = parseCSV('date,airline,origin,destination,notes,durationMinutes,durationKind,durationSource\n1/1/2024,United,SEA,LAX,"first line\nsecond, line",165,actual-block,manual\n');
        const result = runQAQC(rows);
        expect(result.errors).toEqual([]);
        expect(result.rows[1]).toContain('first line\nsecond, line');
        expect(result.rows[1].slice(-3)).toEqual(['165', 'actual-block', 'manual']);
    });
    it('rejects missing headers, empty data, malformed rows and invalid durations before output', () => {
        expect(runQAQC([['date', 'airline']]).errors.length).toBeGreaterThan(0);
        expect(() => parseCSV('date,airline,origin,destination\n1/1/2024,United,SEA')).toThrow();
        const rows = parseCSV('date,airline,origin,destination,durationMinutes,durationKind,durationSource\n1/1/2024,United,SEA,LAX,2.45,actual-block,manual');
        expect(runQAQC(rows).errors).toContainEqual(expect.stringContaining('durationMinutes'));
    });
});
