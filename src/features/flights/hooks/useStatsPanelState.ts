import { useState, useEffect } from 'react';

const STORAGE_KEY = 'flights-stats-panel-open';

export function useStatsPanelState(defaultOpen = false) {
  const [isOpen, setIsOpen] = useState(() => {
    // Only access localStorage on mount
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        return stored === 'true';
      }
    }
    return defaultOpen;
  });

  // Persist to localStorage whenever state changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(isOpen));
  }, [isOpen]);

  return [isOpen, setIsOpen] as const;
}
