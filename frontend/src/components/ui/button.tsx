import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 rounded-lg text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090B] disabled:pointer-events-none disabled:opacity-45 cursor-pointer select-none',
  {
    variants: {
      variant: {
        primary:
          'bg-emerald-400 text-zinc-950 font-semibold hover:bg-emerald-300 active:scale-[0.98] shadow-[0_0_24px_rgba(52,211,153,0.2)]',
        default:
          'bg-emerald-400 text-zinc-950 font-semibold hover:bg-emerald-300 active:scale-[0.98] shadow-[0_0_24px_rgba(52,211,153,0.2)]',
        secondary:
          'bg-zinc-900 text-zinc-100 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 active:scale-[0.98]',
        outline:
          'bg-transparent text-zinc-200 border border-zinc-800 hover:bg-zinc-900 hover:text-white active:scale-[0.98]',
        ghost:
          'bg-transparent text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-100',
        destructive:
          'bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25 hover:text-red-200',
      },
      size: {
        default: 'h-10 px-5 py-2.5',
        sm: 'h-9 px-3.5 py-2 text-xs',
        lg: 'h-12 px-6 py-3 text-sm',
        icon: 'h-10 w-10 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
