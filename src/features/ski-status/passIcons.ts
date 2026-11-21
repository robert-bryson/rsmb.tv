import runtimeIcons from '../../../projects/ski-status/data/runtime-icons.json' with { type: 'json' };
import { skiAssetUrl, skiRuntimeIconFile } from '../../../shared/skiAssets';
import type { PassFamily } from './catalog';

export const passIconSize = 16;

function passIconUrl(family: PassFamily) {
    const file = `pass-icons/${family}.png` as const;
    return skiAssetUrl(skiRuntimeIconFile(file, runtimeIcons[file]));
}

export const passIconUrls: Record<PassFamily, string> = {
    ikon: passIconUrl('ikon'),
    epic: passIconUrl('epic'),
    indy: passIconUrl('indy'),
    'mountain-collective': passIconUrl('mountain-collective'),
};
