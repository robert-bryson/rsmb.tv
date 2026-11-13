import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackAnalyticsEvent, type MapFeature } from '../utils/analytics';
import { prefetchRollout } from '../navigation/prefetchTargets';

const maps: Record<string, { feature: MapFeature; selector: string }> = {
  '/projects/flights/map': { feature: 'flights', selector: '[data-testid="flights-map"]' },
  '/projects/temperature-records/map': { feature: 'temperature-records', selector: '[data-testid="temperature-map"]' },
  '/projects/tornado-tracks/map': { feature: 'tornado-tracks', selector: '[data-testid="tornado-map"]' },
  '/projects/adv-atlas/map': { feature: 'adv-atlas', selector: '[data-testid="trip-atlas-map"]' },
  '/projects/pins-of-inaccessibility/map': { feature: 'pins-of-inaccessibility', selector: '[data-testid="pins-map"]' },
};

/** Initial usability, the first failure at each stage, and the first recovery. */
export function MapPerformance() {
  const { pathname } = useLocation();
  const visit = useRef({ pathname, start: 0, navigation: 'document', usable: false, failed: false, runtimeFailed: false, runtimeRecovered: false });
  useEffect(() => {
    if (visit.current.pathname !== pathname) visit.current = { pathname, start: performance.now(), navigation: 'client', usable: false, failed: false, runtimeFailed: false, runtimeRecovered: false };
    const current = visit.current;
    const config = maps[pathname];
    if (!config) return;
    const inspect = () => {
      const marker = document.querySelector<HTMLElement>('[data-route-path]');
      const routeError = document.querySelector('[data-testid="page-error"]');
      if (marker?.dataset.routePath !== pathname && !routeError) return;
      const state = routeError ? 'error' : document.querySelector<HTMLElement>(config.selector)?.dataset.mapState;
      const ready = state === 'ready' || state === 'degraded' || state === 'fallback';
      if (!state) return;
      if (current.usable) {
        if (state === 'error' && !current.runtimeFailed) {
          current.runtimeFailed = true;
          trackAnalyticsEvent('map-runtime-error', { feature: config.feature, revision: __BUILD_REVISION__ }, pathname);
        } else if (ready && current.runtimeFailed && !current.runtimeRecovered) {
          current.runtimeRecovered = true;
          trackAnalyticsEvent('map-recovered', { feature: config.feature, state, phase: 'runtime' }, pathname);
        }
        return;
      }
      if (ready) current.usable = true;
      else if (state === 'error' && !current.failed) current.failed = true;
      else return;
      trackAnalyticsEvent(ready ? 'map-ready' : 'map-startup-error', {
        feature: config.feature, state, durationMs: Math.round(performance.now() - current.start),
        navigation: current.navigation, revision: __BUILD_REVISION__,
        prefetch: prefetchRollout(), device: window.matchMedia('(max-width: 767px)').matches ? 'mobile' : 'desktop',
      }, pathname);
      if (ready && current.failed) {
        trackAnalyticsEvent('map-recovered', { feature: config.feature, state, phase: 'startup' }, pathname);
      }
    };
    const observer = new MutationObserver(inspect);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-map-state', 'data-route-path'] });
    inspect();
    return () => observer.disconnect();
  }, [pathname]);
  return null;
}
