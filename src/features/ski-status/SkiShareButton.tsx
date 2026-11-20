import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { shareLink } from '../../utils/shareLink';
import { SkiDialog } from './SkiControls';
import { SkiIcon } from './SkiIcon';

export function SkiShareButton({ getUrl }: { getUrl: () => string }) {
    const [copied, setCopied] = useState(false);
    const [manualLink, setManualLink] = useState('');
    const pending = useRef(false);
    const dialog = useRef<HTMLDialogElement>(null);
    const linkInput = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!copied) return;
        const timer = window.setTimeout(() => setCopied(false), 2500);
        return () => window.clearTimeout(timer);
    }, [copied]);

    useLayoutEffect(() => {
        if (!manualLink) return;
        dialog.current?.showModal();
        linkInput.current?.focus();
    }, [manualLink]);

    async function share() {
        if (pending.current) return;
        pending.current = true;
        setCopied(false);
        try {
            const url = getUrl();
            const result = await shareLink('ski-status', url);
            if (result === 'copied') setCopied(true);
            if (result === 'manual') setManualLink(url);
        } finally {
            pending.current = false;
        }
    }

    return <div className="ski-share">
        <button type="button" className="ski-control ski-icon-button" aria-label="Share current view" title="Share current view"
            onClick={() => { void share(); }}><SkiIcon name="share" /></button>
        <span className={copied ? 'ski-share-feedback' : 'sr-only'} role="status">{copied ? 'Link copied' : ''}</span>
        <SkiDialog dialog={dialog} id="ski-share" title="Share current view" onClose={() => setManualLink('')}>
            <label htmlFor="ski-share-link" className="block text-sm">Copy this link</label>
            <input ref={linkInput} id="ski-share-link" className="ski-input mt-1 w-full" readOnly value={manualLink}
                onFocus={event => event.currentTarget.select()} />
        </SkiDialog>
    </div>;
}
