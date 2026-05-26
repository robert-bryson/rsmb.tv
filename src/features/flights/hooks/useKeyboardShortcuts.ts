import { useState, useEffect } from 'react';

interface UseKeyboardShortcutsOptions {
  onToggleStats: () => void;
  onToggleFilter: () => void;
  onResetView: () => void;
  onClearSelection: () => void;
  onColorModeChange: (mode: number) => void;
  onToggleAllAirports?: () => void;
  onToggleUSStates?: () => void;
  onShortcut?: () => void;
}

function isEditableTarget(target: EventTarget | null) {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return true;
  }

  if (!(target instanceof HTMLElement)) return false;

  return target.isContentEditable ||
    target.contentEditable === 'true' ||
    target.closest('[contenteditable="true"]') !== null;
}

export function useKeyboardShortcuts({
  onToggleStats,
  onToggleFilter,
  onResetView,
  onClearSelection,
  onColorModeChange,
  onToggleAllAirports,
  onToggleUSStates,
  onShortcut,
}: UseKeyboardShortcutsOptions) {
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'h':
          onShortcut?.();
          setShowHelp((prev) => !prev);
          break;
        case 's':
          onShortcut?.();
          onToggleStats();
          break;
        case 'f':
          onShortcut?.();
          onToggleFilter();
          break;
        case 'r':
          onShortcut?.();
          onResetView();
          break;
        case 'a':
          // Shift+A toggles all airports layer
          if (e.shiftKey && onToggleAllAirports) {
            e.preventDefault();
            onShortcut?.();
            onToggleAllAirports();
          }
          break;
        case 'u':
          // Shift+U toggles US states layer
          if (e.shiftKey && onToggleUSStates) {
            e.preventDefault();
            onShortcut?.();
            onToggleUSStates();
          }
          break;
        case 'escape':
          onShortcut?.();
          setShowHelp(false);
          onClearSelection();
          break;
        case '1':
          onShortcut?.();
          onColorModeChange(0); // default
          break;
        case '2':
          onShortcut?.();
          onColorModeChange(1); // year
          break;
        case '3':
          onShortcut?.();
          onColorModeChange(2); // frequency
          break;
        case '4':
          onShortcut?.();
          onColorModeChange(3); // airline
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleStats, onToggleFilter, onResetView, onClearSelection, onColorModeChange, onToggleAllAirports, onToggleUSStates, onShortcut]);

  return { showHelp, setShowHelp };
}
