import fs from 'node:fs';
import { isDeepStrictEqual } from 'node:util';

export function writeFlightGeoJson(outputPath, geojson, space) {
    const output = JSON.parse(JSON.stringify(geojson));
    let previous;
    try {
        previous = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    } catch (error) {
        if (error?.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
    }
    if (typeof previous?.metadata?.generatedAt === 'string'
        && Number.isFinite(Date.parse(previous.metadata.generatedAt))) {
        const candidate = {
            ...output,
            metadata: { ...output.metadata, generatedAt: previous.metadata.generatedAt },
        };
        if (isDeepStrictEqual(candidate, previous)) return false;
    }
    fs.writeFileSync(outputPath, JSON.stringify(output, null, space));
    return true;
}