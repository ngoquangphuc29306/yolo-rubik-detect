import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: DialogProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rv-dialog-title"
      onClick={onClose}
    >
      <div
        className={cn(
          'w-full max-w-lg rounded-xl bg-[#111113] border border-zinc-800 shadow-2xl p-6 text-zinc-100',
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-zinc-800/80">
          <div>
            <h3 id="rv-dialog-title" className="text-base font-semibold text-zinc-100">
              {title}
            </h3>
            {description && (
              <p className="mt-1 text-sm text-zinc-400 leading-relaxed">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors cursor-pointer shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="pt-5">{children}</div>
      </div>
    </div>
  );
}
