import { useEffect, useMemo, useState } from 'react';
import seedReports from '../../../projects/ski-status/data/conditions/pilot-reports.json';
import seedForecasts from '../../../projects/ski-status/data/conditions/pilot-forecasts.json';
import { forecastSnapshotSchema, reportSnapshotSchema } from './conditions';
import { loadConditionsFeed, type ConditionsFeed } from './conditions-feed';

const minute = 60_000;
const initialReports = reportSnapshotSchema.parse(seedReports);
const initialForecasts = forecastSnapshotSchema.parse(seedForecasts);

export function useSkiConditions() {
    const [now, setNow] = useState(Date.now);
    const [feed, setFeed] = useState<ConditionsFeed>({});

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
                }
            } catch {
                // Keep the most recent valid snapshots on provider and network failures.
            } finally {
                if (!signal.aborted) refresh = setTimeout(() => { void load(); }, 5 * minute);
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
    const reports = useMemo(() => new Map(reportData.reports.map(report => [report.areaId, report])), [reportData]);
    const forecasts = useMemo(() => new Map(forecastData.forecasts.map(forecast => [forecast.areaId, forecast])), [forecastData]);
    return useMemo(() => ({ reports, forecasts, now }), [reports, forecasts, now]);
}
