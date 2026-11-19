import type { PassFamily } from './catalog';
import { passIconSize, passIconUrls } from './passIcons';

export function SkiPassIcon({ family, size = passIconSize }: { family: PassFamily; size?: number }) {
    return <img src={passIconUrls[family]} alt="" width={size} height={size} className="shrink-0 rounded-sm" />;
}
