import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/** Orient a new page visit after its lazy content commits, without changing return navigation. */
export function RouteOrientation() {
  const location = useLocation();
  const navigation = useNavigationType();
  const previousPath = useRef(location.pathname);
  const announcement = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const changed = previousPath.current !== location.pathname;
    previousPath.current = location.pathname;
    if (!changed || navigation === 'POP' || location.hash
      || (location.state as { restoreScroll?: boolean } | null)?.restoreScroll) return;

    let settled = false;
    let interacted = false;
    let frame = 0;
    const started = performance.now();
    const rememberInteraction = (event: Event) => { if (event.timeStamp > started) interacted = true; };
    const orient = () => {
      const marker = document.querySelector<HTMLElement>('[data-route-path]');
      if (settled || (marker?.dataset.routePath !== location.pathname && !document.querySelector('[data-testid="page-error"]'))) return;
      settled = true;
      observer.disconnect();
      const main = document.querySelector<HTMLElement>('main, [role="main"]');
      const title = main?.querySelector('h1')?.textContent?.trim() || document.title;
      if (announcement.current) announcement.current.textContent = `${title} loaded`;
      if (main && !interacted) {
        main.tabIndex = -1;
        main.focus({ preventScroll: true });
      }
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(orient); };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-route-path'] });
    document.addEventListener('pointerdown', rememberInteraction);
    document.addEventListener('keydown', rememberInteraction);
    schedule();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', rememberInteraction);
      document.removeEventListener('keydown', rememberInteraction);
    };
  }, [location.pathname, location.hash, location.state, navigation]);

  return <p ref={announcement} data-route-announcement aria-live="polite" aria-atomic="true" className="sr-only" />;
}
