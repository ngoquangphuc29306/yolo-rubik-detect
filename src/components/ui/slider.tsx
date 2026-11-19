import * as React from 'react';
import { cn } from '@/src/lib/utils';

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  ariaLabel?: string;
  className?: string;
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  ariaLabel = 'Slider',
  className,
}: SliderProps) {
  const pct = ((value - min) / Math.max(1, max - min)) * 100;

  return (
    <div className={cn('relative flex w-full items-center select-none touch-none py-2', className)}>
      <div className="relative h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-emerald-400 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      <div
        className="pointer-events-none absolute h-4 w-4 -ml-2 rounded-full bg-zinc-100 border-2 border-emerald-400 shadow-md transition-transform"
        style={{ left: `${pct}%` }}
      />
    </div>
  );
}
