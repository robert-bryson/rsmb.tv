import { useEffect, useMemo, useRef, useState } from 'react';
import type { FeatureCollection } from 'geojson';
import type { BasemapState } from '../../maps/recoverBasemap';
import type { ResilientFullscreenControl } from '../../maps/ResilientFullscreenControl';
import { pinCircles, pinPoints } from './geometry';
import { pinStateFips } from '../../../shared/worldPins';
import { radiusLines, visibleRadiusPins } from './radii';
import { EMPTY } from './mapLayers';
import { createPinsRenderer } from './mapRenderer';
import type { PinsMapProps } from './types';
import 'maplibre-gl/dist/maplibre-gl.css';

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
    const scopedPins = useMemo(() => props.pins.filter(pin => !props.stateFips || pinStateFips(pin) === props.stateFips), [props.pins, props.stateFips]);
    const points = useMemo(() => pinPoints(scopedPins), [scopedPins]);
    const circles = useMemo(() => props.circles ? pinCircles(scopedPins.filter(pin => (pin.level !== 'county' || props.showCounties) && (pin.level !== 'state' || props.showRegions !== false))) : EMPTY,
        [scopedPins, props.circles, props.showCounties, props.showRegions]);
    const selection = useMemo<FeatureCollection>(() => {
        if (!props.selected) return EMPTY;
        return pinCircles([props.selected], 144);
    }, [props.selected]);
    const radii = useMemo(() => radiusLines(visibleRadiusPins(scopedPins, props.zoom, props.circles, props.showCounties, props.selected, props.showRegions), props.unit, props.selected?.id ?? null),
        [scopedPins, props.zoom, props.circles, props.showCounties, props.selected, props.unit, props.showRegions]);
    const datasets = useRef({ points, circles, selection, radii });

    useEffect(() => {
        latest.current = props;
        datasets.current = { points, circles, selection, radii };
        renderer.current?.sync();
    }, [props, points, circles, selection, radii]);

    useEffect(() => {
        // Start after layout. A cancelled mount must not allocate a WebGL context.
        const frame = requestAnimationFrame(() => {
            if (!container.current || !labelOverlay.current) return;
            try {
                renderer.current = createPinsRenderer({
                    container: container.current, overlay: labelOverlay.current,
                    previousFullscreen: fullscreen.current,
                    getProps: () => latest.current, getData: () => datasets.current,
                    onError: setError, onBasemapState: setBasemapState, onReady: () => setRendered(true),
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
