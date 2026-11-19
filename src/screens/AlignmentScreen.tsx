import * as React from 'react';
import { ArrowRight, CameraOff, Clock, Hand } from 'lucide-react';
import { WorkspaceHeader } from '@/src/components/WorkspaceHeader';
import { RubiksCube3D } from '@/src/components/three/RubiksCube3D';
import { Button } from '@/src/components/ui/button';
import { Slider } from '@/src/components/ui/slider';
import {
  STICKER_COLORS,
  StickerColor,
  getCenterColorForFace,
} from '@/src/lib/cubeEngine';
import { useRubikStore } from '@/src/store/useRubikStore';
import { cn } from '@/src/lib/utils';

const SPEED_PRESETS = [
  { label: 'Fast', seconds: 3 },
  { label: 'Comfortable', seconds: 5 },
  { label: 'Relaxed', seconds: 8 },
  { label: 'Unrushed', seconds: 12 },
];

export function AlignmentScreen() {
  const {
    initialCube,
    solution,
    moveDelaySeconds,
    setMoveDelaySeconds,
    resetSolveSession,
    setScreen,
  } = useRubikStore();

  const topColor = getCenterColorForFace(initialCube, 'U');
  const frontColor = getCenterColorForFace(initialCube, 'F');
  const rightColor = getCenterColorForFace(initialCube, 'R');

  const topMeta = STICKER_COLORS[topColor];
  const frontMeta = STICKER_COLORS[frontColor];
  const rightMeta = STICKER_COLORS[rightColor];

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 flex flex-col">
      <WorkspaceHeader
        activeStage="solve"
        rightSlot={
          <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
            <CameraOff className="h-3.5 w-3.5 text-zinc-500" />
            <span>Camera Off</span>
          </div>
        }
      />

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10 flex flex-col gap-8">
        {/* Heading Strip */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <p className="font-mono text-xs text-emerald-400 uppercase tracking-wider">
              Pre-Solve Orientation
            </p>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-50">
              Align your physical cube with the digital twin
            </h1>
            <p className="text-sm text-zinc-400 max-w-2xl">
              Hold your cube so its three visible centers match the colors below. Your webcam is no
              longer needed during solving — every move is timed to your chosen pace.
            </p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setScreen('reconstructing')}
            className="self-start md:self-auto"
          >
            Back to Summary
          </Button>
        </div>

        {/* Two-Column Visual Alignment Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left: Large Interactive 3D Digital Twin with Orientation Labels */}
          <section className="lg:col-span-7 rounded-2xl bg-[#111113] border border-zinc-800/80 p-5 sm:p-6 flex flex-col justify-between relative min-h-[400px]">
            <div className="flex items-center justify-between gap-3 z-10">
              <span className="text-sm font-medium text-zinc-200">
                Your Reconstructed Digital Twin
              </span>
              <span className="font-mono text-xs text-zinc-400 tabular-nums">
                {solution.length} moves ready
              </span>
            </div>

            <div className="relative flex-1 min-h-[320px] my-2">
              <RubiksCube3D
                cubies={initialCube}
                mode="interactive"
                cameraPosition={[4.3, 3.3, 4.9]}
                className="w-full h-full"
              />

              {/* Clear Spatial Orientation Labels: Top, Front, Right */}
              <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#09090B]/90 border border-zinc-800 text-xs">
                <span
                  className="w-2.5 h-2.5 rounded-[2px] border border-white/20"
                  style={{ backgroundColor: topMeta.hex }}
                />
                <span className="text-zinc-400">Top:</span>
                <span className="font-medium text-zinc-100">{topMeta.name}</span>
              </div>

              <div className="pointer-events-none absolute bottom-5 left-4 sm:left-8 flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#09090B]/90 border border-zinc-800 text-xs">
                <span
                  className="w-2.5 h-2.5 rounded-[2px] border border-white/20"
                  style={{ backgroundColor: frontMeta.hex }}
                />
                <span className="text-zinc-400">Front:</span>
                <span className="font-medium text-zinc-100">{frontMeta.name}</span>
              </div>

              <div className="pointer-events-none absolute bottom-5 right-4 sm:right-8 flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#09090B]/90 border border-zinc-800 text-xs">
                <span
                  className="w-2.5 h-2.5 rounded-[2px] border border-white/20"
                  style={{ backgroundColor: rightMeta.hex }}
                />
                <span className="text-zinc-400">Right:</span>
                <span className="font-medium text-zinc-100">{rightMeta.name}</span>
              </div>
            </div>

            <p className="text-xs text-zinc-500 text-center">
              Drag to inspect your cube; centers stay fixed relative to each other.
            </p>
          </section>

          {/* Right: Hands Holding Reference + Instructions + Speed Config */}
          <aside className="lg:col-span-5 flex flex-col gap-5">
            {/* Reference Illustration of Hands Holding Physical Cube */}
            <div className="rounded-2xl bg-[#111113] border border-zinc-800/80 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                  <Hand className="h-4 w-4 text-emerald-400" />
                  <span>Physical Holding Position</span>
                </div>
                <span className="text-xs font-mono text-zinc-500">Derived from scan</span>
              </div>

              {/* Clean isometric SVG illustration of hands holding cube with real derived center colors */}
              <div className="rounded-xl bg-[#09090B] border border-zinc-800/80 p-4 flex items-center justify-center">
                <HandsCubeReferenceSVG
                  topColor={topColor}
                  frontColor={frontColor}
                  rightColor={rightColor}
                />
              </div>

              {/* Clear Center Alignment Instructions */}
              <ul className="space-y-2.5 pt-1 text-sm">
                <li className="flex items-center gap-3 text-zinc-200">
                  <span
                    className="w-4 h-4 rounded-[4px] border border-white/25 shrink-0"
                    style={{ backgroundColor: topMeta.hex }}
                  />
                  <span>
                    Keep the <strong className="font-semibold text-white">{topMeta.name.toLowerCase()}</strong>{' '}
                    center facing <strong className="font-semibold text-white">upward</strong> (Top).
                  </span>
                </li>
                <li className="flex items-center gap-3 text-zinc-200">
                  <span
                    className="w-4 h-4 rounded-[4px] border border-white/25 shrink-0"
                    style={{ backgroundColor: frontMeta.hex }}
                  />
                  <span>
                    Keep the <strong className="font-semibold text-white">{frontMeta.name.toLowerCase()}</strong>{' '}
                    center facing <strong className="font-semibold text-white">you</strong> (Front).
                  </span>
                </li>
                <li className="flex items-center gap-3 text-zinc-200">
                  <span
                    className="w-4 h-4 rounded-[4px] border border-white/25 shrink-0"
                    style={{ backgroundColor: rightMeta.hex }}
                  />
                  <span>
                    Keep the <strong className="font-semibold text-white">{rightMeta.name.toLowerCase()}</strong>{' '}
                    center facing <strong className="font-semibold text-white">right</strong> (Right).
                  </span>
                </li>
              </ul>
            </div>

            {/* Solving Speed Configurator & Primary CTA */}
            <div className="rounded-2xl bg-[#111113] border border-zinc-800/80 p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                  <Clock className="h-4 w-4 text-emerald-400" />
                  <span>Auto-Guidance Delay</span>
                </div>
                <span className="font-mono text-sm font-semibold text-emerald-400 tabular-nums">
                  {moveDelaySeconds}s per move
                </span>
              </div>

              <Slider
                value={moveDelaySeconds}
                min={2}
                max={15}
                onChange={setMoveDelaySeconds}
                ariaLabel="Seconds between solving moves"
              />

              <div className="grid grid-cols-4 gap-2">
                {SPEED_PRESETS.map((preset) => (
                  <button
                    key={preset.seconds}
                    type="button"
                    onClick={() => setMoveDelaySeconds(preset.seconds)}
                    className={cn(
                      'py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap',
                      moveDelaySeconds === preset.seconds
                        ? 'bg-emerald-400/15 border-emerald-400/60 text-emerald-300'
                        : 'bg-[#09090B] border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                    )}
                  >
                    {preset.label} · {preset.seconds}s
                  </button>
                ))}
              </div>

              <div className="pt-2 border-t border-zinc-800/80 flex items-center gap-2 text-xs text-zinc-400">
                <CameraOff className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                <span>Camera stays off while solving. Pause or adjust speed anytime.</span>
              </div>

              <Button size="lg" className="w-full" onClick={resetSolveSession}>
                Start AI Guidance
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

/**
 * Clean studio technical illustration of hands holding a 3x3 cube with dynamically derived
 * Top / Front / Right center stickers matching the user's scanned cube.
 */
function HandsCubeReferenceSVG({
  topColor,
  frontColor,
  rightColor,
}: {
  topColor: StickerColor;
  frontColor: StickerColor;
  rightColor: StickerColor;
}) {
  const topHex = STICKER_COLORS[topColor].hex;
  const frontHex = STICKER_COLORS[frontColor].hex;
  const rightHex = STICKER_COLORS[rightColor].hex;

  return (
    <svg
      viewBox="0 0 320 190"
      className="w-full max-w-[300px] h-auto"
      role="img"
      aria-label={`Reference showing hands holding cube with ${STICKER_COLORS[topColor].name} on top, ${STICKER_COLORS[frontColor].name} facing front, and ${STICKER_COLORS[rightColor].name} on right`}
    >
      {/* Subtle desk glow */}
      <ellipse cx="160" cy="166" rx="92" ry="14" fill="rgba(52, 211, 153, 0.08)" />

      {/* Left hand silhouette gripping left-front corner */}
      <path
        d="M52 152 C68 124, 88 112, 108 106 L112 126 C99 131, 92 142, 86 164 Z"
        fill="#27272A"
        stroke="#3F3F46"
        strokeWidth="1.5"
      />
      <rect
        x="96"
        y="99"
        width="26"
        height="13"
        rx="6"
        transform="rotate(24 96 99)"
        fill="#3F3F46"
        stroke="#52525B"
        strokeWidth="1.2"
      />

      {/* Right hand silhouette gripping right-front corner */}
      <path
        d="M268 152 C252 124, 232 112, 212 106 L208 126 C221 131, 228 142, 234 164 Z"
        fill="#27272A"
        stroke="#3F3F46"
        strokeWidth="1.5"
      />
      <rect
        x="198"
        y="110"
        width="26"
        height="13"
        rx="6"
        transform="rotate(-24 198 110)"
        fill="#3F3F46"
        stroke="#52525B"
        strokeWidth="1.2"
      />

      {/* Isometric 3x3 Cube Shell */}
      {/* Top Face */}
      <polygon
        points="160,34 218,67 160,100 102,67"
        fill="#141418"
        stroke="#3F3F46"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Top Center Sticker Highlight */}
      <polygon
        points="160,56 179,67 160,78 141,67"
        fill={topHex}
        stroke="#09090B"
        strokeWidth="1.5"
      />
      {/* Subtle outer top grid lines */}
      <path
        d="M121.3,56 L179.3,89 M140.7,45 L198.7,78 M140.7,89 L198.7,56 M121.3,78 L179.3,45"
        stroke="#27272A"
        strokeWidth="1.2"
      />

      {/* Front (Left-Isometric) Face */}
      <polygon
        points="102,67 160,100 160,164 102,131"
        fill="#111114"
        stroke="#3F3F46"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Front Center Sticker Highlight */}
      <polygon
        points="121.3,99 140.7,110 140.7,131.5 121.3,120.5"
        fill={frontHex}
        stroke="#09090B"
        strokeWidth="1.5"
      />
      <path
        d="M121.3,78 L121.3,142 M140.7,89 L140.7,153 M102,88.3 L160,121.3 M102,109.7 L160,142.7"
        stroke="#27272A"
        strokeWidth="1.2"
      />

      {/* Right (Right-Isometric) Face */}
      <polygon
        points="160,100 218,67 218,131 160,164"
        fill="#16161B"
        stroke="#3F3F46"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Right Center Sticker Highlight */}
      <polygon
        points="179.3,110 198.7,99 198.7,120.5 179.3,131.5"
        fill={rightHex}
        stroke="#09090B"
        strokeWidth="1.5"
      />
      <path
        d="M179.3,89 L179.3,153 M198.7,78 L198.7,142 M160,121.3 L218,88.3 M160,142.7 L218,109.7"
        stroke="#27272A"
        strokeWidth="1.2"
      />

      {/* Orientation Callout Lines & Labels */}
      <line x1="160" y1="30" x2="160" y2="16" stroke="#34D399" strokeWidth="1.2" />
      <text
        x="160"
        y="12"
        textAnchor="middle"
        fill="#E4E4E7"
        fontSize="10"
        fontFamily="JetBrains Mono, monospace"
      >
        TOP · {STICKER_COLORS[topColor].name.toUpperCase()}
      </text>

      <line x1="112" y1="114" x2="72" y2="94" stroke="#34D399" strokeWidth="1.2" />
      <text
        x="66"
        y="92"
        textAnchor="end"
        fill="#E4E4E7"
        fontSize="10"
        fontFamily="JetBrains Mono, monospace"
      >
        FRONT
      </text>

      <line x1="208" y1="114" x2="248" y2="94" stroke="#34D399" strokeWidth="1.2" />
      <text
        x="254"
        y="92"
        textAnchor="start"
        fill="#E4E4E7"
        fontSize="10"
        fontFamily="JetBrains Mono, monospace"
      >
        RIGHT
      </text>
    </svg>
  );
}
