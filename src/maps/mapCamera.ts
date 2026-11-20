export interface MapCamera {
    center: [number, number];
    zoom: number;
    bearing: number;
    pitch: number;
}

const wrapAngle = (value: number) => ((value + 180) % 360 + 360) % 360 - 180;

export function mapCameraCodec(minZoom: number, maxZoom: number) {
    /** Fixed precision makes links stable without writing rounded values back to the moving map. */
    function encode(camera: MapCamera): string | undefined {
        const values = [...camera.center, camera.zoom, camera.bearing, camera.pitch];
        if (!values.every(Number.isFinite) || Math.abs(camera.center[1]) > 90
            || camera.zoom < minZoom || camera.zoom > maxZoom || camera.pitch < 0 || camera.pitch > 60) return;
        return [wrapAngle(camera.center[0]), camera.center[1], camera.zoom, wrapAngle(camera.bearing), camera.pitch]
            .map((value, index) => {
                const rounded = Number(value.toFixed(index < 2 ? 6 : index === 2 ? 4 : 2));
                return String(index === 0 || index === 3 ? Number(wrapAngle(rounded).toFixed(6)) : rounded);
            }).join(',');
    }

    function read(value: string | null): MapCamera | undefined {
        if (!value) return;
        const parts = value.split(',').map(part => part.trim());
        if (parts.length !== 5 || parts.some(part => !/^-?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/i.test(part))) return;
        const [lng, lat, zoom, bearing, pitch] = parts.map(Number);
        if (Math.abs(lng) > 180 || Math.abs(bearing) > 180) return;
        const camera: MapCamera = { center: [lng, lat], zoom, bearing, pitch };
        return encode(camera) ? camera : undefined;
    }

    return { encode, read };
}
