import { usePersistedState } from '../../../hooks/usePersistedState';

const STORAGE_KEY = 'flights-stats-panel-open';

export function useStatsPanelState(defaultOpen = false) {
  return usePersistedState(STORAGE_KEY, defaultOpen);
}
