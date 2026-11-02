import { useId, useState, type ReactNode } from 'react';

interface CollapsibleSectionProps {
  title: string;
  icon?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
}

export function CollapsibleSection({
  title,
  icon,
  children,
  defaultOpen = true,
  isOpen: controlledIsOpen,
  onToggle,
}: CollapsibleSectionProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(defaultOpen);
  const contentId = useId();

  // Use controlled state if provided, otherwise use internal state
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const handleToggle = onToggle ?? (() => setInternalIsOpen(open => !open));

  return (
    <div className="mt-4 pt-3 border-t border-gray-700">
      <h4>
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={contentId}
          onClick={handleToggle}
          className="flex items-center justify-between w-full text-left group rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
        >
          <span className="text-gray-400 text-xs uppercase tracking-wide flex items-center gap-1.5">
            {icon && <span aria-hidden="true">{icon}</span>}
            {title}
          </span>
          <span aria-hidden="true" className="text-gray-500 group-hover:text-gray-300 transition-colors text-xs">
            {isOpen ? '▼' : '▶'}
          </span>
        </button>
      </h4>
      <div id={contentId} hidden={!isOpen} className="mt-2">{isOpen && children}</div>
    </div>
  );
}
