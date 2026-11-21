import { useEffect, useState } from 'react';
import {
    skiArchiveAssetUrl, skiArchiveIconVariant, skiArchiveIndex, skiArchiveIndexUrl,
    type SkiArchiveAsset, type SkiArchiveTrailMap,
} from '../../../shared/skiArchive';

export interface SkiArchiveResort {
    mapIcon?: string;
    detailsIcon?: string;
    trailMaps?: SkiArchiveTrailMap[];
}

export type SkiArchive = ReadonlyMap<string, SkiArchiveResort>;

function groupAssets(assets: SkiArchiveAsset[]): SkiArchive {
    const resorts = new Map<string, SkiArchiveResort>();
    for (const asset of assets) {
        const resort = resorts.get(asset.areaId) ?? {};
        if (asset.kind === 'trail map') {
            (resort.trailMaps ??= []).push(asset);
        } else {
            const variant = skiArchiveIconVariant(asset.relativePath);
            if (variant) resort[variant] = skiArchiveAssetUrl(asset);
        }
        resorts.set(asset.areaId, resort);
    }
    return resorts;
}

export function useSkiArchive() {
    const [archive, setArchive] = useState<SkiArchive>();
    useEffect(() => {
        if (!import.meta.env.DEV || import.meta.env.MODE === 'test') return;
        const controller = new AbortController();
        void (async () => {
            try {
                const response = await fetch(skiArchiveIndexUrl, { signal: controller.signal, cache: 'no-store' });
                if (!response.ok) return;
                const result = skiArchiveIndex.safeParse(await response.json());
                if (result.success && result.data.length && !controller.signal.aborted) setArchive(groupAssets(result.data));
            } catch {
                // The catalog and published links are available when the NAS is offline.
            }
        })();
        return () => controller.abort();
    }, []);
    return archive;
}
