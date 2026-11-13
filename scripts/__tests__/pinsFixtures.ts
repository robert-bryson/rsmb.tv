import fs from 'node:fs';
import path from 'node:path';
import { pinsDataSchema } from '../../shared/pins';

export function readPinsArtifact(filename: string): unknown {
    return JSON.parse(fs.readFileSync(path.resolve('public/data/pins-of-inaccessibility', filename), 'utf8'));
}
export const publishedPins = pinsDataSchema.parse(readPinsArtifact('pins.json'));
export const colorado = publishedPins.pins.find(pin => pin.id === 'state-08')!;
export const national = publishedPins.pins.find(pin => pin.id === 'country-US')!;
export const fallsChurch = publishedPins.pins.find(pin => pin.id === 'county-51610')!;
