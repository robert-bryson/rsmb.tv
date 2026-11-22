import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { isSpecialtySkiing, skiAreas } from '../features/ski-status/catalog';
import type { BaseForecast, ResortReport } from '../features/ski-status/conditions';
import SkiDataStatus from '../features/ski-status/SkiDataStatus';
import type { SkiConditions } from '../features/ski-status/useSkiConditions';

const generatedAt = '2026-12-25T13:00:00Z';
const bundledAt = '2026-11-21T12:00:00Z';
const source = { name: 'Test operator', url: 'https://example.test/report', exportable: false };
const bundled = {
    now: Date.parse(generatedAt), feed: {}, feedStatus: 'checking', reportsLoading: true,
    reports: new Map(), forecasts: new Map(), reportsGeneratedAt: bundledAt, forecastsGeneratedAt: bundledAt,
} satisfies SkiConditions;

function value(label: string) {
    return screen.getByText(label, { selector: 'dt', exact: true }).nextElementSibling;
}

it('shows bundled snapshot dates while the manifest loads and when it is unavailable', () => {
    const { rerender } = render(<SkiDataStatus conditions={bundled} />);
    expect(screen.getByRole('status')).toHaveTextContent('Checking feed');
    expect(value('Last feed publication')).toHaveTextContent('Waiting for feed');
    expect(value('Reports snapshot')).toHaveTextContent('Bundled');
    expect(value('Reports snapshot')?.querySelector('time')).toHaveAttribute('datetime', bundledAt);

    rerender(<SkiDataStatus conditions={{ ...bundled, feedStatus: 'unavailable', reportsLoading: false }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Feed unavailable');
    expect(value('Last feed publication')).toHaveTextContent('Unavailable');
    expect(value('Forecasts snapshot')).toHaveTextContent('Bundled');
});

it('counts reports for the local ski day and labels retained and published snapshots independently', () => {
    const reportsGeneratedAt = '2026-12-25T12:45:00Z';
    const retrievedAt = '2026-12-25T12:30:00Z';
    const reports: ResortReport[] = [
        { areaId: 'alta', status: 'limited', source, retrievedAt, reportedAt: retrievedAt },
        { areaId: 'snowbird', status: 'season-closed', source, retrievedAt, reportedAt: retrievedAt },
        { areaId: 'park-city-mountain', status: 'open', source, retrievedAt, reportedAt: '2026-12-25T03:00:00Z' },
        { areaId: 'whaleback', status: 'unknown', source, retrievedAt, reportedAt: retrievedAt },
        { areaId: 'outside-catalog', status: 'open', source, retrievedAt, reportedAt: retrievedAt },
    ];
    const forecastsGeneratedAt = '2026-12-24T13:15:00Z';
    const forecast: BaseForecast = {
        areaId: 'alta', retrievedAt: forecastsGeneratedAt, source, startsAt: forecastsGeneratedAt,
        endsAt: '2026-12-25T13:15:00Z', location: 'Base', snowfallCm: 0,
    };
    const forecasts = [forecast, { ...forecast, areaId: 'snowbird', endsAt: generatedAt }];
    const reportsFile = `reports-${'1'.repeat(64)}.json`;
    const nextReportsFile = `reports-${'2'.repeat(64)}.json`;
    const forecastsFile = `forecasts-${'3'.repeat(64)}.json`;
    const manifest = {
        version: 1 as const, updatedAt: generatedAt, catalogRevision: 'a'.repeat(64),
        reports: nextReportsFile, forecasts: forecastsFile,
    };
    const conditions: SkiConditions = {
        ...bundled, feedStatus: 'available', reportsLoading: false, reportsGeneratedAt, forecastsGeneratedAt,
        reports: new Map(reports.map(report => [report.areaId, report])),
        forecasts: new Map(forecasts.map(row => [row.areaId, row])),
        feed: {
            manifest,
            reports: { file: reportsFile, data: { version: 1, generatedAt: reportsGeneratedAt, reports } },
            forecasts: { file: forecastsFile, data: { version: 1, generatedAt: forecastsGeneratedAt, forecasts } },
        },
    };
    const { rerender } = render(<SkiDataStatus conditions={conditions} />);
    expect(screen.getByRole('status')).toHaveTextContent('Snapshot unavailable');
    expect(value('Reports snapshot')).toHaveTextContent('Last verified');
    expect(value('Forecasts snapshot')).toHaveTextContent('Published');
    expect(value('Last feed publication')?.querySelector('time')).toHaveAttribute('datetime', generatedAt);
    expect(value('Current operating reports')?.querySelector('small')).toHaveTextContent(/^1 open or limited · 1 closed$/);
    expect(value('Stale or unverified reports')?.querySelector('small')).toHaveTextContent(/^1 stale · 1 unverified$/);
    expect(value('Areas without a report')).toHaveTextContent(String(skiAreas.length - 4));
    expect(value('Current forecasts')).toHaveTextContent(/^1$/);

    const downhill = skiAreas.filter(area => !isSpecialtySkiing(area.skiing)).length;
    expect(screen.getByText('All six comparison fields').nextElementSibling).toHaveTextContent(new RegExp(` / ${downhill}$`));
    expect(screen.getByText('Local time zones').nextElementSibling).toHaveTextContent(new RegExp(` / ${skiAreas.length}$`));

    rerender(<SkiDataStatus conditions={{ ...conditions, feed: { ...conditions.feed, manifest: { ...manifest, reports: reportsFile } } }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Feed reachable');
    expect(value('Reports snapshot')).toHaveTextContent('Published');
});
