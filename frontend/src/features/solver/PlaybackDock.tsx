import { Lock, Pause, Play, RotateCcw, Unlock, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface PlaybackDockProps {
  paused: boolean;
  /** Pause/Resume is meaningless once the run is complete. */
  pauseDisabled: boolean;
  onTogglePause: () => void;
  onReplay: () => void;
  delaySeconds: number;
  onDelayChange: (seconds: number) => void;
  cameraLocked: boolean;
  onToggleLock: () => void;
  lockTitle: string;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

/** Unified bottom control dock (zero viewport occlusion). There is no skip/previous/next: playback is linear. */
export function PlaybackDock({
  paused,
  pauseDisabled,
  onTogglePause,
  onReplay,
  delaySeconds,
  onDelayChange,
  cameraLocked,
  onToggleLock,
  lockTitle,
  soundEnabled,
  onToggleSound,
}: PlaybackDockProps) {
  return (
    <div className="relative z-10 mt-auto pb-5 px-4 flex justify-center pointer-events-none">
      <div className="pointer-events-auto w-full max-w-[820px] rounded-2xl bg-[#111113]/95 border border-zinc-800/90 px-4 py-3 shadow-2xl flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        {/* Playback & Replay Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={onTogglePause}
            disabled={pauseDisabled}
            className="min-w-[96px]"
          >
            {paused ? (
              <>
                <Play className="h-3.5 w-3.5" />
                Resume
              </>
            ) : (
              <>
                <Pause className="h-3.5 w-3.5" />
                Pause
              </>
            )}
          </Button>

          <Button variant="secondary" size="sm" onClick={onReplay} title="Replay current move">
            <RotateCcw className="h-3.5 w-3.5" />
            Replay
          </Button>
        </div>

        {/* Adjustable Delay Speed Slider (2s - 15s) */}
        <div className="flex items-center gap-3 flex-1 min-w-[170px] max-w-[260px] px-1">
          <span className="text-xs text-zinc-400 whitespace-nowrap">Pace</span>
          <Slider
            value={delaySeconds}
            min={2}
            max={15}
            onChange={onDelayChange}
            ariaLabel="Solving delay in seconds"
          />
          <span
            data-testid="pace-label"
            className="font-mono text-xs text-emerald-400 tabular-nums w-7 text-right"
          >
            {delaySeconds}s
          </span>
        </div>

        {/* Utility Controls: Fixed Angle Lock & Sound Toggle */}
        <div className="flex items-center gap-2">
          <Button
            variant={cameraLocked ? 'secondary' : 'outline'}
            size="sm"
            onClick={onToggleLock}
            title={lockTitle}
          >
            {cameraLocked ? (
              <Lock className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Unlock className="h-3.5 w-3.5 text-zinc-400" />
            )}
            <span className="hidden md:inline">{cameraLocked ? 'Angle Locked' : 'Free Orbit'}</span>
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={onToggleSound}
            aria-label={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
            title={soundEnabled ? 'Sound on' : 'Sound muted'}
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <VolumeX className="h-4 w-4 text-zinc-500" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
