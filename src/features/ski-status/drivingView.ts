import {
    drivingBulletinMatches, drivingBulletinState, drivingCameraRefreshMs, drivingDistanceMeters, drivingProviders, drivingStaleMs,
    isDriveBcImageUrl, normalizeDrivingRoad,
    type DrivingBulletin, type DrivingCamera, type DrivingPoint, type DrivingProvider,
} from '../../../shared/skiDriving';
import { drivingAreaProviders, drivingPassReports, type DrivingApproach, type DrivingArrival, type DrivingPass } from '../../../shared/skiDrivingCatalog';
import type { SkiDriving } from './useSkiDriving';

export type DrivingReportView = {
    entry: DrivingBulletin;
    provider: DrivingProvider;
    state: ReturnType<typeof drivingBulletinState>;
};
export type DrivingCameraView = { entry: DrivingCamera; provider: DrivingProvider; available: boolean };
export type DrivingFeature =
    | { id: string; kind: 'pass'; point: DrivingPoint; label: string; pass: DrivingPass; reports: DrivingReportView[] }
    | { id: string; kind: 'parking'; point: DrivingPoint; label: string; arrival: DrivingArrival }
    | { id: string; kind: 'camera'; point: DrivingPoint; label: string; camera: DrivingCameraView }
    | { id: string; kind: 'report'; point: DrivingPoint; label: string; report: DrivingReportView };

export const drivingDirections = { east: 'Eastbound', west: 'Westbound', south: 'Southbound', north: 'Northbound', both: 'Both directions' };
export const drivingReportLabels = { closure: 'Closure', restriction: 'Restriction', delay: 'Delay', condition: 'Road report' };
export const drivingProviderZones: Record<DrivingProvider, string> = {
    wsdot: 'America/Los_Angeles', drivebc: 'America/Vancouver', udot: 'America/Denver',
    tripcheck: 'America/Los_Angeles', caltrans: 'America/Los_Angeles',
};
const nearbyMeters = 35_000;
const sortByKind = { closure: 0, restriction: 1, delay: 2, condition: 3 };
const sortByState = { active: 0, scheduled: 1, advisory: 2, stale: 3 };

export function roadReportState(data: SkiDriving, provider: DrivingProvider) {
    if (data.feedStatus === 'unavailable') return 'unavailable';
    if (data.feedStatus === 'checking') return 'checking';
    const feed = data.feed.providers[provider];
    if (feed?.reportsStatus === 'unconfigured') return 'unconfigured';
    if (!feed?.reportsReady || !feed.reports) return 'unavailable';
    const age = data.now - Date.parse(feed.reports.data.checkedAt);
    return age >= 0 && age < drivingStaleMs ? 'current' : 'stale';
}

export function drivingReports(data: SkiDriving, provider: DrivingProvider): DrivingReportView[] {
    const feed = data.feed.providers[provider];
    const reports = feed?.reports?.data;
    if (!reports) return [];
    const available = roadReportState(data, provider) === 'current';
    return reports.entries.map(entry => ({ entry, provider, state: drivingBulletinState(entry, data.now, reports.checkedAt, available) }));
}

export function drivingCameras(data: SkiDriving, provider: DrivingProvider): DrivingCameraView[] {
    const feed = data.feed.providers[provider];
    const cameras = feed?.cameras?.data;
    if (!cameras) return [];
    const age = data.now - Date.parse(cameras.checkedAt);
    const available = data.feedStatus === 'available' && feed.camerasReady && age >= 0 && age < 2 * drivingCameraRefreshMs(provider);
    return cameras.entries.map(entry => ({ entry, provider, available }));
}

export function drivingApproachReports(data: SkiDriving, areaId: string, areaPoint: DrivingPoint, approach?: DrivingApproach) {
    const provider = drivingAreaProviders[areaId];
    const selectedRoads = approach?.roads.map(normalizeDrivingRoad) ?? [];
    const exact: DrivingReportView[] = [];
    const nearby: DrivingReportView[] = [];
    if (!provider) return { exact, nearby };
    const arrival = approach?.arrivalId && data.catalog?.arrivals[approach.arrivalId];
    const destination = arrival ? arrival.point : areaPoint;
    for (const report of drivingReports(data, provider)) {
        const { entry, state } = report;
        if (!selectedRoads.includes(normalizeDrivingRoad(entry.road))) continue;
        const passReport = approach?.passIds?.some(id => {
            const pass = drivingPassReports[id];
            return pass?.provider === provider && pass.reportId === entry.id;
        });
        if (passReport || (state !== 'advisory' && !entry.advisory && approach?.segments?.some(segment => drivingBulletinMatches(entry, segment)))) {
            exact.push(report);
        } else if (drivingDistanceMeters(destination, entry.point) <= nearbyMeters) {
            nearby.push(report);
        }
    }
    const sort = (a: DrivingReportView, b: DrivingReportView) =>
        sortByState[a.state] - sortByState[b.state] || sortByKind[a.entry.kind] - sortByKind[b.entry.kind]
        || drivingDistanceMeters(a.entry.point, destination) - drivingDistanceMeters(b.entry.point, destination);
    return { exact: exact.sort(sort), nearby: nearby.sort(sort) };
}

export function nearestDrivingCameras(data: SkiDriving, areaId: string, destination: DrivingPoint, approach?: DrivingApproach) {
    const provider = drivingAreaProviders[areaId];
    if (!provider) return [];
    const selectedRoads = new Set(approach?.roads.map(normalizeDrivingRoad));
    return drivingCameras(data, provider)
        .map(camera => ({ camera, distance: drivingDistanceMeters(destination, camera.entry.point) }))
        .filter(({ camera, distance }) => distance <= nearbyMeters && (!selectedRoads.size || selectedRoads.has(normalizeDrivingRoad(camera.entry.road))))
        .sort((a, b) => a.distance - b.distance).slice(0, 8).map(({ camera }) => camera);
}

export function drivingMapFeatures(data: SkiDriving): DrivingFeature[] {
    if (!data.catalog) return [];
    const reportsByProvider = new Map(drivingProviders.map(provider => [provider, drivingReports(data, provider)]));
    const linkedPassReports = new Set<string>();
    const features: DrivingFeature[] = Object.entries(data.catalog.passes).map(([id, pass]) => {
        const match = drivingPassReports[id];
        if (match) linkedPassReports.add(`${match.provider}:${match.reportId}`);
        const reports = match ? reportsByProvider.get(match.provider)?.filter(({ entry }) => entry.id === match.reportId) ?? [] : [];
        return { id: `pass:${id}`, kind: 'pass', point: pass.coordinates, label: pass.name, pass, reports };
    });
    for (const [id, arrival] of Object.entries(data.catalog.arrivals)) {
        features.push({ id: `parking:${id}`, kind: 'parking', point: arrival.point, label: arrival.name, arrival });
    }
    for (const [provider, reports] of reportsByProvider) {
        for (const report of reports) {
            const id = `${provider}:${report.entry.id}`;
            if (linkedPassReports.has(id) || report.state === 'stale') continue;
            features.push({ id: `report:${id}`, kind: 'report', point: report.entry.point, label: report.entry.title, report });
        }
        for (const camera of drivingCameras(data, provider)) {
            features.push({ id: `camera:${provider}:${camera.entry.id}`, kind: 'camera', point: camera.entry.point, label: camera.entry.name, camera });
        }
    }
    return features;
}

export function approachLine(approach: DrivingApproach | undefined, arrivals: Record<string, DrivingArrival> | undefined) {
    const local = approach?.arrivalId && arrivals?.[approach.arrivalId]?.connector.line;
    return [...(approach?.segments ?? []).flatMap(({ line }) => line ? [line] : []), ...(local ? [local] : [])];
}

export function drivingCameraImage(camera: DrivingCamera, now: number, available: boolean) {
    const age = camera.imageUpdatedAt ? now - Date.parse(camera.imageUpdatedAt) : Infinity;
    if (available && age >= 0 && age <= 60 * 60_000 && camera.image && isDriveBcImageUrl(camera.id, camera.image)) return camera.image;
}
