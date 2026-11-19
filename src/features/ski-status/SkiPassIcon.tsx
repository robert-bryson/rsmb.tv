import type { PassFamily } from './catalog';
import { passIconSize, passIconUrls } from './passIcons';

export function SkiPassIcon({ family }: { family: PassFamily }) {
    return <img src={passIconUrls[family]} alt="" width={passIconSize} height={passIconSize} className="shrink-0" />;
}
