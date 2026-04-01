import type { ElementType } from "react";

interface SectionHeaderProps {
  icon: ElementType;
  title: string;
  subtitle?: string;
}

export function SectionHeader({ icon: Icon, title, subtitle }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="w-8 h-8 rounded-lg bg-surface-100 flex items-center justify-center">
        <Icon className="w-4 h-4 text-surface-500" />
      </div>
      <div>
        <h3 className="font-semibold text-surface-900 text-sm">{title}</h3>
        {subtitle && <p className="text-xs text-surface-400">{subtitle}</p>}
      </div>
    </div>
  );
}
