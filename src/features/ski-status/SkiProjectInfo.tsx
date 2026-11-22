import { lazy, Suspense, useLayoutEffect, useRef, useState } from 'react';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { IntentLink } from '../../components/IntentLink';
import { moduleLoader } from '../../navigation/moduleLoader';
import { SITE_URL } from '../../utils/siteMetadata';
import { SkiDialog } from './SkiControls';
import type { SkiConditions } from './useSkiConditions';

const SkiDataStatus = lazy(moduleLoader(() => import('./SkiDataStatus')));

export function SkiProjectInfo({ conditions }: { conditions: SkiConditions }) {
    const dialog = useRef<HTMLDialogElement>(null);
    const title = useRef<HTMLHeadingElement>(null);
    const [admin, setAdmin] = useState(false);

    useLayoutEffect(() => {
        if (!dialog.current?.open) return;
        dialog.current.scrollTop = 0;
        title.current?.focus({ preventScroll: true });
    }, [admin]);

    return <>
        <button type="button" className="ski-control" aria-haspopup="dialog" aria-controls="ski-about"
            onClick={event => {
                event.currentTarget.focus({ preventScroll: true });
                dialog.current?.showModal();
                title.current?.focus({ preventScroll: true });
            }}>About</button>
        <SkiDialog dialog={dialog} id="ski-about" title={admin ? 'Data quality and status' : 'About ski-status'} titleRef={title}
            className={admin ? 'ski-admin-dialog' : undefined} onClose={() => setAdmin(false)} footer={admin
                ? <button type="button" className="ski-control" onClick={() => setAdmin(false)}>Back to About</button>
                : <button type="button" className="ski-control ski-primary" onClick={() => setAdmin(true)}>Open admin panel</button>}
        >
            {admin ? <ErrorBoundary fallback={<p role="alert">The data overview is unavailable.</p>}>
                <Suspense fallback={<p role="status">Loading data overview…</p>}>
                    <SkiDataStatus conditions={conditions} />
                </Suspense>
            </ErrorBoundary> : <div className="ski-about-copy">
                <p>Explore ski areas, compare mountain statistics, and find official resort conditions.</p>
                <dl className="ski-about-build">
                    <div><dt>Version</dt><dd>{__BUILD_VERSION__}</dd></div>
                    <div><dt>Last build date</dt><dd>{__BUILD_DATE__}</dd></div>
                </dl>
                <div>
                    <p>Created by Robert Bryson</p>
                    <p>Contact me at <a href="mailto:hello@rsmb.tv">hello@rsmb.tv</a></p>
                    <p><IntentLink to={SITE_URL}>Visit rsmb.tv</IntentLink></p>
                </div>
            </div>}
        </SkiDialog>
    </>;
}
