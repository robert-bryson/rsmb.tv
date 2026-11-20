import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSkiBig3Report, skiBig3Areas, skiBig3Report } from '../../projects/ski-status/scripts/ski-big3-source';
import { skiDayStatus } from '../../src/features/ski-status/conditions';

const sunshine = skiBig3Areas[0];
const observedAt = '2026-11-20T16:00:00Z';

function xml(time: string, lifts: number, runs: number) {
    return `<conditions><last_updated>${time}</last_updated><lifts-open>${lifts}</lifts-open><lifts-total>12</lifts-total>
        <runs-open>${runs}</runs-open><runs-total>139</runs-total></conditions>`;
}

describe('SkiBig3 conditions review', () => {
    afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

    it('reads dated counts in Alberta time and keeps the source outside CSV export', () => {
        const report = skiBig3Report(xml('2026-11-20 08:44:28', 3, 4), sunshine, observedAt);
        expect(report).toMatchObject({ areaId: 'banff-sunshine', reportedAt: '2026-11-20T08:44:28-06:00',
            status: 'limited', lifts: { open: 3, total: 12 }, trails: { open: 4, total: 139 }, source: { exportable: false } });
        expect(skiDayStatus(report, Date.parse('2026-11-21T05:59:59Z'), 'America/Edmonton')).toBe('limited');
        expect(skiDayStatus(report, Date.parse('2026-11-21T06:00:00Z'), 'America/Edmonton')).toBe('unknown');
        expect(skiBig3Report(xml('2026-06-14 08:00:00', 12, 139), sunshine, '2026-06-14T16:00:00Z'))
            .toMatchObject({ reportedAt: '2026-06-14T08:00:00-06:00', status: 'open' });
    });

    it('treats zero terrain as unverified and rejects missing, contradictory, and future data', () => {
        expect(skiBig3Report(xml('2026-11-20 08:44:28', 0, 0), sunshine, observedAt).status).toBe('unknown');
        expect(() => skiBig3Report(xml('', 3, 4), sunshine, observedAt)).toThrow(/report time/);
        expect(() => skiBig3Report(xml('2026-11-20 08:44:28', 13, 4), sunshine, observedAt)).toThrow(/lifts counts/);
        expect(() => skiBig3Report(xml('2026-11-20 10:44:28', 3, 4), sunshine, observedAt)).toThrow(/report time/);
        expect(() => skiBig3Report(xml('2026-03-08 02:44:28', 3, 4), sunshine, observedAt)).toThrow(/report time/);
    });

    it('rejects ambiguous wall times and conflicting counts', () => {
        expect(() => skiBig3Report(xml('2025-11-02 01:30:00', 3, 4), sunshine, '2025-11-02T16:00:00Z')).toThrow(/report time/);
        const report = xml('2026-11-20 08:44:28', 3, 4);
        expect(() => skiBig3Report(report.replace('</conditions>', '<lifts-open>0</lifts-open></conditions>'), sunshine, observedAt))
            .toThrow(/lifts counts/);
        expect(() => skiBig3Report(report.replace('<runs-open>4</runs-open>', '<runs-open><value>4</value></runs-open>'), sunshine, observedAt))
            .toThrow(/runs counts/);
    });

    it('loads the configured resort feed and refuses redirects', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(observedAt));
        const fetch = vi.fn(async () => new Response(xml('2026-11-20 08:44:28', 3, 4)));
        vi.stubGlobal('fetch', fetch);
        await expect(fetchSkiBig3Report(sunshine)).resolves.toMatchObject({ areaId: 'banff-sunshine', retrievedAt: observedAt.replace('Z', '.000Z') });
        expect(fetch).toHaveBeenCalledExactlyOnceWith(sunshine.feed, expect.objectContaining({ redirect: 'error' }));
    });
});
