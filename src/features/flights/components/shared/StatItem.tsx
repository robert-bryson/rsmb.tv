import type { ReactNode } from 'react';

interface BaseStatItemProps {
  icon: string;
  label: string;
  value: string;
  subValue?: ReactNode;
  className?: string;
}

type StaticStatItemProps = BaseStatItemProps & {
  onClick?: undefined;
  isSelected?: never;
  ariaLabel?: never;
  title?: string;
};

type ClickableStatItemProps = BaseStatItemProps & {
  onClick: () => void;
  isSelected?: boolean;
  ariaLabel: string;
  title?: string;
};

type StatItemProps = StaticStatItemProps | ClickableStatItemProps;

export function StatItem({
  icon,
  label,
  value,
  subValue,
  className = '',
  onClick,
  isSelected = false,
  ariaLabel,
  title,
}: StatItemProps) {
  const content = (
    <>
      <span className="text-lg" aria-hidden="true">{icon}</span>
      <div>
        <div className="text-gray-400 text-xs">{label}</div>
        <div className="text-white font-medium">{value}</div>
        {subValue && <div className="text-gray-500 text-xs">{subValue}</div>}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={isSelected}
        aria-label={ariaLabel}
        title={title}
        className={`flex w-full items-start gap-2 rounded-md p-1 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${isSelected ? 'bg-cyan-500/15 ring-1 ring-cyan-400/40' : 'hover:bg-white/5'} ${className}`}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={`flex items-start gap-2 ${className}`}>
      {content}
    </div>
  );
}
