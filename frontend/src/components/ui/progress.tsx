import { cn } from '@/lib/utils';

interface ProgressProps {
  value: number; // 0 to 100
  className?: string;
  indicatorClassName?: string;
}

export function Progress({ value, className, indicatorClassName }: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-[#27272A]', className)}
    >
      <div
        className={cn(
          'h-full bg-[#34D399] transition-transform duration-300 ease-out origin-left',
          indicatorClassName
        )}
        style={{ transform: `scaleX(${clamped / 100})` }}
      />
    </div>
  );
}
