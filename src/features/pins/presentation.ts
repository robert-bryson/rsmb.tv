import { pinStateFips, type MapPin } from '../../../shared/worldPins';

/** Keep sibling jurisdictions for orientation, without drawing every out-of-scope county. */
export function visibleMapPins(pins: MapPin[], contextPins: MapPin[], stateFips: string) {
    const visible = new Map(pins.filter(pin => pin.level !== 'county' || !stateFips || pinStateFips(pin) === stateFips)
        .map(pin => [pin.id, pin]));
    for (const pin of contextPins) if (!visible.has(pin.id)) visible.set(pin.id, pin);
    return [...visible.values()];
}

export function contextPinIds(pins: MapPin[], contextPins: MapPin[], stateFips: string, selected: MapPin | null) {
    const outside = new Set(contextPins.map(pin => pin.id));
    return new Set(pins.filter(pin => selected ? pin.id !== selected.id
        : outside.has(pin.id) || !!stateFips && pinStateFips(pin) !== stateFips).map(pin => pin.id));
}

/** During selection, compare peer radii and reserve detailed measurements for the selected pin. */
export function circlePeers(pins: MapPin[], context: ReadonlySet<string>, selected: MapPin | null) {
    return selected ? pins.filter(pin => pin.level === selected.level) : pins.filter(pin => !context.has(pin.id));
}
