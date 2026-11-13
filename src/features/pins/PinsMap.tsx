import { useEffect, useMemo, useRef, useState } from 'react';
import type { FeatureCollection } from 'geojson';
import type { BasemapState } from '../../maps/recoverBasemap';
import type { ResilientFullscreenControl } from '../../maps/ResilientFullscreenControl';
import { pinCircles, pinPoints } from './geometry';
import type { MapPin } from '../../../shared/worldPins';
import { circlePeers, contextPinIds, visibleMapPins } from './presentation';
import { RADIUS_MIN_ZOOM, radiusLines } from './radii';
import { COUNTY_CIRCLE_ZOOM } from './zoom';
import { EMPTY } from './mapLayers';
import { createPinsRenderer } from './mapRenderer';
import { useCountyCircles } from './useCountyCircles';
import type { PinsMapProps } from './types';
import 'maplibre-gl/dist/maplibre-gl.css';
const NO_PINS: MapPin[] = [];

export function PinsMap(props: PinsMapProps) {
    const container = useRef<HTMLDivElement>(null);
    const labelOverlay = useRef<HTMLDivElement>(null);
    const latest = useRef(props);
    const renderer = useRef<ReturnType<typeof createPinsRenderer> | null>(null);
    const fullscreen = useRef<ResilientFullscreenControl | null>(null);
    const [attempt, setAttempt] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [rendered, setRendered] = useState(false);
    const [basemapState, setBasemapState] = useState<BasemapState>('loading');
    const contextPins = props.contextPins ?? NO_PINS;
    const scopedPins = useMemo(() => visibleMapPins(props.pins, contextPins, props.stateFips), [props.pins, contextPins, props.stateFips]);
    const context = useMemo(() => contextPinIds(scopedPins, contextPins, props.stateFips, props.selected), [scopedPins, contextPins, props.stateFips, props.selected]);
    const points = useMemo(() => pinPoints(scopedPins, context), [scopedPins, context]);
    const countiesEnabled = props.countyMode !== 'off';
    const prepareCountyCircles = countiesEnabled && props.zoom >= COUNTY_CIRCLE_ZOOM - 1;
    const prepareCountyRadii = countiesEnabled && props.zoom >= RADIUS_MIN_ZOOM.county - 1;
    const peers = useMemo(() => props.circles ? circlePeers(scopedPins, context, props.selected).filter(pin => pin.id !== props.selected?.id) : [],
        [scopedPins, context, props.selected, props.circles]);
    const circles = useMemo(() => pinCircles(peers.filter(pin => pin.level !== 'county' && (pin.level !== 'state' || props.showRegions !== false)), 72, context),
        [peers, context, props.showRegions]);
    const countyPins = useMemo(() => peers.filter(pin => pin.level === 'county'), [peers]);
    const countyCircles = useCountyCircles(countyPins, context, prepareCountyCircles);
    const selection = useMemo<FeatureCollection>(() => {
        if (!props.selected) return EMPTY;
        return pinCircles([props.selected], 144);
    }, [props.selected]);
    // Native zoom filters and paint stops reveal each measurement. Only prepare
    // a new batch when a detail stage changes, never on fractional zoom updates.
    const overviewRadiusPins = useMemo(() => props.selected || !props.circles ? NO_PINS
        : scopedPins.filter(pin => !context.has(pin.id) && (pin.level !== 'county' || prepareCountyRadii) && (pin.level !== 'state' || props.showRegions !== false)),
        [scopedPins, context, prepareCountyRadii, props.circles, props.selected, props.showRegions]);
    const radii = useMemo(() => radiusLines(props.selected ? [props.selected] : overviewRadiusPins, props.unit, props.selected?.id ?? null),
        [props.selected, overviewRadiusPins, props.unit]);
    const datasets = useRef({ points, circles, countyCircles, selection, radii });

    useEffect(() => {
        latest.current = props;
        datasets.current = { points, circles, countyCircles, selection, radii };
        renderer.current?.sync();
    }, [props, points, circles, countyCircles, selection, radii]);

    useEffect(() => {
        // Start after layout. A cancelled mount must not allocate a WebGL context.
        const frame = requestAnimationFrame(() => {
            if (!container.current || !labelOverlay.current) return;
            try {
                renderer.current = createPinsRenderer({
                    container: container.current, overlay: labelOverlay.current,
                    previousFullscreen: fullscreen.current,
                    getProps: () => latest.current, getData: () => datasets.current,
                    onError: setError, onBasemapState: setBasemapState,
                    onLoading: () => setRendered(false), onReady: () => setRendered(true),
                });
                fullscreen.current = renderer.current.fullscreen;
            } catch {
                setError('The map renderer could not start. You can still explore every pin in the panel.');
            }
        });
        return () => {
            cancelAnimationFrame(frame);
            renderer.current?.dispose();
            renderer.current = null;
        };
    }, [attempt]);

    const retry = () => {
        setError(null);
        setRendered(false);
        setBasemapState('loading');
        setAttempt(value => value + 1);
    };
    const state = error || props.dataState === 'error' ? 'error'
        : !rendered || props.dataState === 'loading' ? 'loading'
            : basemapState === 'unavailable' ? 'degraded' : 'ready';
    return <>
        <div className="pins-map-canvas" ref={container} data-testid="pins-map" data-map-state={state} />
        <div className="pins-radius-labels" ref={labelOverlay} role="group" aria-label="Radius distances" />
        {basemapState === 'unavailable' && !error && <div className="pins-map-message" role="status">
            Background unavailable. Pins and boundaries remain usable.
            <button type="button" onClick={() => renderer.current?.retryBasemap()}>Retry background</button>
        </div>}
        {error && <div className="pins-map-message" role="alert">{error}
            <button type="button" onClick={retry}>Retry map</button>
        </div>}
    </>;
}
