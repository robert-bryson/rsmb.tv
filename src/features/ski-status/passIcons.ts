import type { PassFamily } from './catalog';
import epic from './pass-icons/epic.png?no-inline';
import ikon from './pass-icons/ikon.png?no-inline';
import indy from './pass-icons/indy.png?no-inline';
import mountainCollective from './pass-icons/mountain-collective.png?no-inline';

export const passIconSize = 16;
export const passIconSpacing = passIconSize + 2;
export const passIconUrls: Record<PassFamily, string> = {
    ikon, epic, indy, 'mountain-collective': mountainCollective,
};
