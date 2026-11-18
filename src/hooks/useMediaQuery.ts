import { useCallback, useMemo, useSyncExternalStore } from 'react';

export function useMediaQuery(query: string) {
  const media = useMemo(() => typeof window === 'undefined' ? undefined : window.matchMedia?.(query), [query]);
  const subscribe = useCallback((notify: () => void) => {
    media?.addEventListener('change', notify);
    return () => media?.removeEventListener('change', notify);
  }, [media]);
  const getSnapshot = useCallback(() => media?.matches ?? false, [media]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
