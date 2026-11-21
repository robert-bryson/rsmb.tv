import { z } from 'zod';
import { httpsUrl, passSeasonId, sha256, skiId } from '../src/features/ski-status/schemas.ts';
import { isSkiAssetPathSegment, skiAssetsRoute, skiAssetUrl } from './skiAssets.ts';

export const skiArchiveIndexUrl = `${skiAssetsRoute}index.json`;

const assetFields = {
    areaId: skiId,
    checkedOn: z.iso.date(),
    source: httpsUrl,
    relativePath: z.string().refine(path => path.split('/').every(isSkiAssetPathSegment)),
    sha256,
    byteCount: z.int().positive(),
};

const trailMap = z.object({
    ...assetFields,
    kind: z.literal('trail map'),
    edition: z.union([passSeasonId, z.string().regex(/^\d{4}$/), z.literal('undated')]),
    coverage: z.string().trim().min(1),
}).refine(({ areaId, edition, relativePath }) => {
    const [folder, area, season, filename, ...rest] = relativePath.split('/');
    return folder === 'trail-maps' && area === areaId && season === edition.replace('/', '-') && rest.length === 0
        && /\.(?:pdf|avif|jpe?g|png|webp)$/i.test(filename ?? '');
});

export function skiArchiveIconVariant(relativePath: string) {
    const name = relativePath.split('/').at(-1);
    if (name === 'map-40.png') return 'mapIcon';
    if (name === 'details-84.png') return 'detailsIcon';
}

const resortIcon = z.object({
    ...assetFields,
    kind: z.enum(['map icon', 'details icon', 'icon variant']),
    sourceSha256: sha256,
}).refine(({ areaId, kind, relativePath, sourceSha256 }) => {
    const [folder, area, digest, , ...rest] = relativePath.split('/');
    const variant = skiArchiveIconVariant(relativePath);
    return folder === 'resort-icons' && area === areaId && digest === sourceSha256 && rest.length === 0 && Boolean(variant)
        && (kind === 'icon variant' || (kind === 'map icon' ? variant === 'mapIcon' : variant === 'detailsIcon'));
});

export const skiArchiveAsset = z.union([trailMap, resortIcon]);
export const skiArchiveIndex = skiArchiveAsset.array();
export type SkiArchiveAsset = z.infer<typeof skiArchiveAsset>;
export type SkiArchiveTrailMap = z.infer<typeof trailMap>;

export function skiArchiveAssetUrl({ relativePath, sha256 }: SkiArchiveAsset) {
    return `${skiAssetUrl(relativePath)}?v=${sha256}`;
}
