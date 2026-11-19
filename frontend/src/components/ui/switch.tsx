import * as React from 'react';
import { cn } from '@/lib/utils';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  ariaLabel?: string;
  className?: string;
}

export function Switch({
  checked,
  onCheckedChange,
  id,
  ariaLabel,
  className,
}: SwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090B]',
        checked ? 'bg-emerald-400 border-emerald-400' : 'bg-zinc-800 border-zinc-700',
        className
      )}
    >
      <span
        className={cn(
          'pointer-events-none block h-4 w-4 rounded-full shadow-sm transition-transform duration-150',
          checked ? 'translate-x-5 bg-zinc-950' : 'translate-x-1 bg-zinc-300'
        )}
      />
    </button>
  );
}
