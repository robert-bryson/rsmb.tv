import { useLayoutEffect, useRef } from 'react';
import { DrivingFeatureDetails } from './SkiDrivingContent';
import { mapDrivingLabel } from './drivingMapLayers';
import { SkiIconButton } from './SkiIcon';
import type { DrivingFeature } from './drivingView';

export function SkiDrivingMapCard({ feature, now, onClose }: { feature: DrivingFeature; now: number; onClose: () => void }) {
    const close = useRef<HTMLButtonElement>(null);
    useLayoutEffect(() => { close.current?.focus({ preventScroll: true }); }, [feature.id]);
    return <section role="dialog" aria-labelledby="ski-driving-map-title" className="ski-driving-map-card">
        <div className="ski-driving-map-heading">
            <div>
                <p className="ski-driving-note">{mapDrivingLabel(feature)}</p>
                <h2 id="ski-driving-map-title">{feature.label}</h2>
            </div>
            <SkiIconButton ref={close} className="ski-quiet-button" icon="close" label="Close driving information" onClick={onClose} />
        </div>
        <DrivingFeatureDetails feature={feature} now={now} />
    </section>;
}
