import { useState, type ReactNode } from 'react';

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

  // Use controlled state if provided, otherwise use internal state
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const handleToggle = onToggle || (() => setInternalIsOpen(!internalIsOpen));

  return (
    <div className="mt-4 pt-3 border-t border-gray-700">
      <button
        onClick={handleToggle}
        className="flex items-center justify-between w-full text-left group"
      >
        <h4 className="text-gray-400 text-xs uppercase tracking-wide flex items-center gap-1.5">
          {icon && <span>{icon}</span>}
          {title}
        </h4>
        <span className="text-gray-500 group-hover:text-gray-300 transition-colors text-xs">
          {isOpen ? '▼' : '▶'}
        </span>
      </button>
      {isOpen && <div className="mt-2">{children}</div>}
    </div>
  );
}
