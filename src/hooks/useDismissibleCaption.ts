import { useState, type FocusEvent, type KeyboardEvent } from 'react';

export function useDismissibleCaption() {
    const [dismissed, setDismissed] = useState(false);

    return {
        dismissed,
        captionInteractionProps: {
            onBlur: (event: FocusEvent<HTMLElement>) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setDismissed(false);
            },
            onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
                if (event.key === 'Escape') setDismissed(true);
            },
            onMouseLeave: () => setDismissed(false),
        },
    };
}