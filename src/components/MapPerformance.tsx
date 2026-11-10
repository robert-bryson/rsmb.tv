import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackAnalyticsEvent } from '../utils/analytics';
import { prefetchRollout } from '../navigation/prefetchTargets';

const maps: Record<string, { feature: string; selector: string }> = {
  '/projects/flights/map': { feature: 'flights', selector: '[data-testid="flights-map"]' },
  '/projects/temperature-records/map': { feature: 'temperature-records', selector: '[data-testid="temperature-map"]' },
  '/projects/tornado-tracks/map': { feature: 'tornado-tracks', selector: '[data-testid="tornado-map"]' },
  '/projects/adv-atlas/map': { feature: 'adv-atlas', selector: '[data-testid="trip-atlas-map"]' },
};

/** Record the first usable map and startup failure, independently of text-based Web Vitals. */
export function MapPerformance() {
  const { pathname } = useLocation();
  const visit = useRef({ pathname, start: 0, navigation: 'document', usable: false, failed: false });
  useEffect(() => {
    if (visit.current.pathname !== pathname) visit.current = { pathname, start: performance.now(), navigation: 'client', usable: false, failed: false };
    const current = visit.current;
    const config = maps[pathname];
    if (!config) return;
    const inspect = () => {
      const marker = document.querySelector<HTMLElement>('[data-route-path]');
      const routeError = document.querySelector('[data-testid="page-error"]');
      if (marker?.dataset.routePath !== pathname && !routeError) return;
      const state = routeError ? 'error' : document.querySelector<HTMLElement>(config.selector)?.dataset.mapState;
      const ready = state === 'ready' || state === 'degraded' || state === 'fallback';
      if (!state || current.usable) return;
      if (ready) current.usable = true;
      else if (state === 'error' && !current.failed) current.failed = true;
      else return;
      trackAnalyticsEvent(ready ? 'map-ready' : 'map-startup-error', {
        feature: config.feature, state, durationMs: Math.round(performance.now() - current.start),
        navigation: current.navigation, revision: __BUILD_REVISION__,
        prefetch: prefetchRollout(), device: window.matchMedia('(max-width: 767px)').matches ? 'mobile' : 'desktop',
      }, pathname);
      if (current.usable) observer.disconnect();
    };
    const observer = new MutationObserver(inspect);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-map-state', 'data-route-path'] });
    inspect();
    return () => observer.disconnect();
  }, [pathname]);
  return null;
}
