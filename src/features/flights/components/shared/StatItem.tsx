import type { ReactNode } from 'react';

interface StatItemProps {
  icon: string;
  label: string;
  value: string;
  subValue?: ReactNode;
  className?: string;
}

export function StatItem({ icon, label, value, subValue, className = '' }: StatItemProps) {
  return (
    <div className={`flex items-start gap-2 ${className}`}>
      <span className="text-lg">{icon}</span>
      <div>
        <div className="text-gray-400 text-xs">{label}</div>
        <div className="text-white font-medium">{value}</div>
        {subValue && <div className="text-gray-500 text-xs">{subValue}</div>}
      </div>
    </div>
  );
}
