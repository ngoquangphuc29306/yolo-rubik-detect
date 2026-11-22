import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { DEMO_SCAN_CONDITIONS, type DemoScanCondition } from '@/demo/demo-scan-source';
import type { ScanCondition } from '@/stores/scan-store';

interface ScanSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  autoCapture: boolean;
  onAutoCaptureChange: (enabled: boolean) => void;
  condition: ScanCondition;
  onSelectCondition: (condition: DemoScanCondition) => void;
  onFlagRightFace: () => void;
}

/** DEMO-only: scripted capture behaviour and simulated state inspector. Never mounted in live mode. */
export function ScanSettingsDialog({
  open,
  onClose,
  autoCapture,
  onAutoCaptureChange,
  condition,
  onSelectCondition,
  onFlagRightFace,
}: ScanSettingsDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Scanner Settings & State Preview"
      description="Configure capture behavior or inspect beginner-friendly error and alignment states."
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-zinc-100">Hands-Free Auto-Capture</p>
            <p className="text-xs text-zinc-400">
              Automatically capture each face once 9/9 stickers stay steady.
            </p>
          </div>
          <Switch
            checked={autoCapture}
            onCheckedChange={onAutoCaptureChange}
            ariaLabel="Toggle hands-free auto-capture"
          />
        </div>

        <div className="pt-4 border-t border-zinc-800/80 space-y-2.5">
          <p className="text-xs font-mono uppercase tracking-wider text-zinc-400">
            Simulate Computer Vision State
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {DEMO_SCAN_CONDITIONS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  onSelectCondition(item.value);
                  onClose();
                }}
                className={cn(
                  'text-left p-2.5 rounded-lg border text-xs transition-colors cursor-pointer',
                  condition === item.value
                    ? 'bg-emerald-400/10 border-emerald-400/60 text-zinc-100'
                    : 'bg-[#09090B] border-zinc-800 text-zinc-300 hover:border-zinc-700'
                )}
              >
                <div className="font-medium">{item.label}</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">{item.hint}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-zinc-800/80 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onFlagRightFace();
              onClose();
            }}
          >
            Flag Right Face for Rescan
          </Button>
          <Button size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
