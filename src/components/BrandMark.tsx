import * as React from 'react';
import { cn } from '@/src/lib/utils';

interface BrandMarkProps {
  onClick?: () => void;
  className?: string;
}

export function BrandMark({ onClick, className }: BrandMarkProps) {
  const content = (
    <span
      className={cn(
        'inline-flex items-center gap-2.5 text-zinc-100 font-semibold tracking-tight whitespace-nowrap shrink-0',
        className
      )}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <path
          d="M12 2.5L20.5 7.4V16.6L12 21.5L3.5 16.6V7.4L12 2.5Z"
          stroke="#F4F4F5"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M12 12L20.5 7.4M12 12L3.5 7.4M12 12V21.5"
          stroke="#71717A"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path
          d="M12 2.5L16.25 4.95L12 7.4L7.75 4.95L12 2.5Z"
          fill="#34D399"
        />
      </svg>
      <span className="font-[var(--font-display)] text-[15px] font-semibold tracking-tight">
        RubikVision
      </span>
    </span>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 rounded-md cursor-pointer whitespace-nowrap shrink-0"
      >
        {content}
      </button>
    );
  }

  return content;
}
