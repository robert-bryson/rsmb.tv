interface KeyboardHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardHelp({ isOpen, onClose }: KeyboardHelpProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="px-6 py-4 space-y-3">
          <ShortcutRow keys={['H']} description="Show/hide this help" />
          <ShortcutRow keys={['S']} description="Toggle stats panel" />
          <ShortcutRow keys={['F']} description="Open filter panel" />
          <ShortcutRow keys={['R']} description="Reset view to default" />
          <ShortcutRow keys={['Esc']} description="Clear selection / close panels" />
          <ShortcutRow keys={['1-4']} description="Switch color modes" />
          <div className="pt-3 border-t border-gray-700">
            <div className="text-gray-500 text-xs uppercase tracking-wide mb-2">Mouse/Touch</div>
            <ShortcutRow keys={['Drag']} description="Rotate globe" />
            <ShortcutRow keys={['Scroll']} description="Zoom in/out" />
            <ShortcutRow keys={['Click']} description="Select airport/route" />
          </div>
        </div>
        <div className="px-6 py-3 bg-gray-800/50 border-t border-gray-700">
          <p className="text-gray-500 text-xs text-center">
            Press <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-gray-300">H</kbd> to close
          </p>
        </div>
      </div>
    </div>
  );
}

function ShortcutRow({ keys, description }: { keys: string[]; description: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-300 text-sm">{description}</span>
      <div className="flex gap-1">
        {keys.map((key) => (
          <kbd
            key={key}
            className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-300 font-mono"
          >
            {key}
          </kbd>
        ))}
      </div>
    </div>
  );
}
