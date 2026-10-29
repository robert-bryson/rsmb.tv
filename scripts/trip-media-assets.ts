import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { TripManifest } from '../shared/tripManifestSchema.ts';

export function validateBundledTripMedia(manifest: TripManifest, { repoRoot, fsImpl = fs }: {
    repoRoot: string;
    fsImpl?: Pick<typeof fs, 'readFileSync'>;
}) {
    const files = [];
    for (const animation of manifest.animations ?? []) {
        for (const url of [animation.src, animation.poster]) {
            if (!url.startsWith('/')) continue;
            const filename = path.join(repoRoot, 'public', url);
            let contents;
            try {
                contents = fsImpl.readFileSync(filename);
            } catch (error) {
                throw new Error(`Trip "${manifest.id}" is missing bundled animation asset: ${url}`, { cause: error });
            }
            const fingerprint = createHash('sha256').update(contents).digest('hex').slice(0, 12);
            if (!url.endsWith(`-${fingerprint}${path.extname(url)}`)) {
                throw new Error(`Trip "${manifest.id}" animation asset has a mismatched fingerprint: ${url}`);
            }
            files.push(filename);
        }
    }
    return files;
}
