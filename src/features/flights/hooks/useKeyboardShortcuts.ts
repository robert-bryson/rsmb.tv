import { useState, useEffect } from 'react';

interface UseKeyboardShortcutsOptions {
  onToggleStats: () => void;
  onToggleFilter: () => void;
  onResetView: () => void;
  onClearSelection: () => void;
  onColorModeChange: (mode: number) => void;
}

export function useKeyboardShortcuts({
  onToggleStats,
  onToggleFilter,
  onResetView,
  onClearSelection,
  onColorModeChange,
}: UseKeyboardShortcutsOptions) {
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'h':
          setShowHelp((prev) => !prev);
          break;
        case 's':
          onToggleStats();
          break;
        case 'f':
          onToggleFilter();
          break;
        case 'r':
          onResetView();
          break;
        case 'escape':
          setShowHelp(false);
          onClearSelection();
          break;
        case '1':
          onColorModeChange(0); // default
          break;
        case '2':
          onColorModeChange(1); // year
          break;
        case '3':
          onColorModeChange(2); // frequency
          break;
        case '4':
          onColorModeChange(3); // airline
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleStats, onToggleFilter, onResetView, onClearSelection, onColorModeChange]);

  return { showHelp, setShowHelp };
}
