import * as React from 'react';
import { BrandMark } from '@/components/BrandMark';
import { ModeBanner } from '@/components/ModeBanner';
import { useSessionStore, type AppScreen } from '@/stores/session-store';
import { cn } from '@/lib/utils';

interface WorkspaceHeaderProps {
  activeStage: 'scan' | 'reconstruct' | 'solve';
  rightSlot?: React.ReactNode;
}

const STAGES: { key: 'scan' | 'reconstruct' | 'solve'; label: string; screen: AppScreen }[] = [
  { key: 'scan', label: 'Scan', screen: 'scanning' },
  { key: 'reconstruct', label: 'Reconstruct', screen: 'reconstructing' },
  { key: 'solve', label: 'Solve', screen: 'solving' },
];

export function WorkspaceHeader({ activeStage, rightSlot }: WorkspaceHeaderProps) {
  const setScreen = useSessionStore((s) => s.setScreen);
  const activeIdx = STAGES.findIndex((s) => s.key === activeStage);

  return (
    <>
    <header className="w-full h-16 px-4 sm:px-6 lg:px-8 border-b border-zinc-800/80 bg-[#09090B] flex items-center justify-between gap-4 shrink-0">
      <BrandMark onClick={() => setScreen('landing')} />

      <nav aria-label="Workflow progress" className="hidden md:flex items-center gap-3 text-sm">
        {STAGES.map((stage, idx) => {
          const isCurrent = idx === activeIdx;
          const isCompleted = idx < activeIdx;
          return (
            <React.Fragment key={stage.key}>
              <span
                className={cn(
                  'inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors',
                  isCurrent
                    ? 'text-zinc-100 font-medium'
                    : isCompleted
                      ? 'text-emerald-400'
                      : 'text-zinc-500'
                )}
              >
                <span
                  className={cn(
                    'font-mono text-xs tabular-nums',
                    isCurrent || isCompleted ? 'text-emerald-400' : 'text-zinc-600'
                  )}
                >
                  0{idx + 1}
                </span>
                <span>{stage.label}</span>
              </span>
              {idx < STAGES.length - 1 && (
                <span className="text-zinc-700 select-none" aria-hidden="true">
                  →
                </span>
              )}
            </React.Fragment>
          );
        })}
      </nav>

      <div className="flex items-center gap-3 shrink-0">{rightSlot}</div>
    </header>
    <ModeBanner />
    </>
  );
}
