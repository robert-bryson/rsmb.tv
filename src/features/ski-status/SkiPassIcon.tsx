import type { PassFamily } from './catalog';
import { passBadgeTextColor, passColors } from './mapAppearance';
import { passIconSize, passIconUrls } from './passIcons';
import { SkiAssetIcon } from './SkiAssetIcon';

const initials: Record<PassFamily, string> = { ikon: 'IK', epic: 'EP', indy: 'IN', 'mountain-collective': 'MC' };

export function SkiPassIcon({ family, size = passIconSize }: { family: PassFamily; size?: number }) {
    return <SkiAssetIcon urls={[passIconUrls[family]]} size={size} className="shrink-0 rounded-sm"
        fallback={<span aria-hidden="true" className="ski-pass-alt grid size-[2em] shrink-0 place-items-center rounded-sm font-bold leading-none"
            style={{ fontSize: size / 2, backgroundColor: passColors[family], color: passBadgeTextColor }}>
            {initials[family]}
        </span>} />;
}
