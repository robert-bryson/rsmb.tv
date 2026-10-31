import type { AtlasPanelState, AtlasResultsView } from './tripAtlasBrowser';

export interface AtlasCamera {
    center: [number, number];
    zoom: number;
    bearing: number;
    pitch: number;
}

export interface AtlasSession {
    camera?: AtlasCamera;
    panelOpen: boolean;
    panelState?: AtlasPanelState;
    resultsView?: AtlasResultsView;
    scrollTop: number;
}

const storageKey = 'rsmb:adv-atlas:sessions:v1';
const sessionLimit = 40;
let sessions: Map<string, AtlasSession> | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

/** Browser storage can contain old, incomplete, or manually edited values. */
function isAtlasSession(value: unknown): value is AtlasSession {
    if (!isRecord(value) || typeof value.panelOpen !== 'boolean'
        || !isFiniteNumber(value.scrollTop) || value.scrollTop < 0) return false;
    if (value.panelState !== undefined && (typeof value.panelState !== 'string' || !['collapsed', 'compact', 'expanded'].includes(value.panelState)
        || value.panelOpen !== (value.panelState !== 'collapsed'))) return false;
    if (value.resultsView !== undefined && (typeof value.resultsView !== 'string' || !['cards', 'table'].includes(value.resultsView))) return false;
    const camera = value.camera;
    if (camera === undefined) return true;
    return isRecord(camera) && Array.isArray(camera.center) && camera.center.length === 2
        && camera.center.every(isFiniteNumber) && Math.abs(camera.center[1]) <= 90
        && isFiniteNumber(camera.zoom) && camera.zoom >= -2 && camera.zoom <= 22
        && isFiniteNumber(camera.bearing)
        && isFiniteNumber(camera.pitch) && camera.pitch >= 0 && camera.pitch <= 60;
}

function snapshot(session: AtlasSession): AtlasSession {
    return {
        panelOpen: session.panelOpen, scrollTop: session.scrollTop,
        ...(session.panelState ? { panelState: session.panelState } : {}),
        ...(session.resultsView ? { resultsView: session.resultsView } : {}),
        ...(session.camera ? { camera: {
            center: [...session.camera.center], zoom: session.camera.zoom,
            bearing: session.camera.bearing, pitch: session.camera.pitch,
        } } : {}),
    };
}

function getSessions() {
    if (sessions) return sessions;
    sessions = new Map();
    try {
        const stored: unknown = JSON.parse(window.sessionStorage.getItem(storageKey) ?? '[]');
        if (Array.isArray(stored)) {
            for (const entry of stored.slice(-sessionLimit)) {
                if (Array.isArray(entry) && entry.length === 2 && typeof entry[0] === 'string' && isAtlasSession(entry[1])) {
                    sessions.set(entry[0], snapshot(entry[1]));
                }
            }
        }
    } catch {
        // A blocked storage API or damaged record must not prevent navigation.
    }
    return sessions;
}

/** Save history and explicit return destinations within this browser tab. */
export function saveAtlasSession(key: string, url: string, session: AtlasSession) {
    const current = getSessions();
    for (const destination of [key, url]) {
        current.delete(destination);
        current.set(destination, snapshot(session));
    }
    while (current.size > sessionLimit) current.delete(current.keys().next().value!);
    try {
        window.sessionStorage.setItem(storageKey, JSON.stringify([...current]));
    } catch {
        // In-memory returns still work when storage is blocked or full.
    }
}

export function readAtlasSession(key: string, returnUrl?: string, returnKey?: string) {
    const current = getSessions();
    // An explicit source visit must never fall back to another visit at the same URL.
    const saved = current.get(key) ?? (returnKey ? current.get(returnKey) : returnUrl ? current.get(returnUrl) : undefined);
    return saved ? snapshot(saved) : undefined;
}
