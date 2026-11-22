import * as React from 'react';
import { COLOR_META, codeToColorName, type StickerCode } from '@/lib/colors';
import { cn } from '@/lib/utils';

interface FaceGrid2DProps {
  stickers?: StickerCode[];
  size?: 'xs' | 'sm' | 'md' | 'lg';
  highlightCenter?: boolean;
  dimmed?: boolean;
  className?: string;
}

export function FaceGrid2D({
  stickers,
  size = 'sm',
  highlightCenter = false,
  dimmed = false,
  className,
}: FaceGrid2DProps) {
  const sizeMap = {
    xs: 'w-10 h-10 gap-0.5 p-0.5',
    sm: 'w-14 h-14 gap-1 p-1',
    md: 'w-20 h-20 gap-1 p-1.5',
    lg: 'w-24 h-24 gap-1.5 p-1.5',
  };

  const cells: (StickerCode | null)[] =
    stickers && stickers.length === 9 ? stickers : Array(9).fill(null);

  return (
    <div
      className={cn(
        'grid grid-cols-3 grid-rows-3 rounded-lg bg-[#09090B] border border-zinc-800/90 shrink-0',
        sizeMap[size],
        dimmed && 'opacity-50',
        className
      )}
    >
      {cells.map((code, idx) => {
        const isCenter = idx === 4;
        const bg = code ? COLOR_META[codeToColorName(code)].hex : '#1f1f24';
        return (
          <div
            key={idx}
            className={cn(
              'rounded-[3px] transition-colors duration-200',
              highlightCenter && isCenter && 'ring-1 ring-emerald-400'
            )}
            style={{ backgroundColor: bg }}
          />
        );
      })}
    </div>
  );
}
