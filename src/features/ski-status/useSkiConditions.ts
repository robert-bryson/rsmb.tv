import { useEffect, useMemo, useState } from 'react';
import seedReports from '../../../projects/ski-status/data/conditions/pilot-reports.json';
import seedForecasts from '../../../projects/ski-status/data/conditions/pilot-forecasts.json';
import operatorReports from '../../../projects/ski-status/data/conditions/operator-reports.json';
import { forecastSnapshotSchema, mergeResortReports, reportSnapshotSchema } from './conditions';
import { loadConditionsFeed, type ConditionsFeed } from './conditions-feed';

const minute = 60_000;
const initialReports = reportSnapshotSchema.parse(seedReports);
const initialForecasts = forecastSnapshotSchema.parse(seedForecasts);
const reviewedReports = reportSnapshotSchema.parse(operatorReports).reports;

export function useSkiConditions() {
    const [now, setNow] = useState(Date.now);
    const [feed, setFeed] = useState<ConditionsFeed>({});
    const [reportsLoading, setReportsLoading] = useState(true);

    useEffect(() => {
        const controller = new AbortController();
        const { signal } = controller;
        let refresh: ReturnType<typeof setTimeout>;
        let current: ConditionsFeed = {};
        async function load() {
            try {
                const next = await loadConditionsFeed(current, signal);
                if (!signal.aborted && next !== current) {
                    current = next;
                    setFeed(next);
                    setNow(Date.now());
                }
            } catch {
                // Keep the most recent valid snapshots on provider and network failures.
            } finally {
                if (!signal.aborted) {
                    setReportsLoading(false);
                    refresh = setTimeout(() => { void load(); }, 5 * minute);
                }
            }
        }
        void load();
        const tick = () => setNow(Date.now());
        const clock = window.setInterval(tick, minute);
        document.addEventListener('visibilitychange', tick);
        return () => {
            controller.abort();
            clearTimeout(refresh);
            window.clearInterval(clock);
            document.removeEventListener('visibilitychange', tick);
        };
    }, []);

    const reportData = feed.reports?.data ?? initialReports;
    const forecastData = feed.forecasts?.data ?? initialForecasts;
    const reports = useMemo(() => {
        const latest = new Map(reviewedReports.map(report => [report.areaId, report]));
        for (const report of reportData.reports) {
            const previous = latest.get(report.areaId);
            latest.set(report.areaId, previous ? mergeResortReports(previous, report, now) : report);
        }
        return latest;
    }, [reportData, now]);
    const forecasts = useMemo(() => new Map(forecastData.forecasts.map(forecast => [forecast.areaId, forecast])), [forecastData]);
    return useMemo(() => ({ reports, forecasts, now, reportsLoading }), [reports, forecasts, now, reportsLoading]);
}
