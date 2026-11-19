import * as React from 'react';
import {
  ArrowRight,
  Camera,
  Box,
  Cpu,
  Layers,
  Play,
  ScanLine,
  Sparkles,
} from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import { Button } from '@/components/ui/button';
import { RubiksCube3D } from '@/components/three/RubiksCube3D';
import { useRubikStore } from '@/store/useRubikStore';
import { cn } from '@/lib/utils';

const HERO_DETECTIONS = [
  { id: 'd1', label: 'G', conf: '0.99', top: '26%', left: '28%', w: '14%', h: '14%', color: '#16A34A' },
  { id: 'd2', label: 'W', conf: '0.98', top: '21%', left: '46%', w: '13%', h: '13%', color: '#F4F4F6' },
  { id: 'd3', label: 'R', conf: '0.97', top: '42%', left: '58%', w: '14%', h: '14%', color: '#DC2626' },
  { id: 'd4', label: 'Y', conf: '0.96', top: '53%', left: '34%', w: '13%', h: '13%', color: '#FACC15' },
  { id: 'd5', label: 'B', conf: '0.98', top: '44%', left: '22%', w: '13%', h: '13%', color: '#2563EB' },
];

const HOW_IT_WORKS_STEPS = [
  {
    num: '01',
    title: 'Scan',
    subtitle: 'Capture all six faces with your webcam',
    description:
      'Hold your physical cube inside the guided 3×3 frame. Fine-tuned YOLO sticker detection locks onto all nine tiles and auto-captures each face as soon as your hand is steady.',
    icon: Camera,
  },
  {
    num: '02',
    title: 'Reconstruct',
    subtitle: 'AI recreates your physical cube digitally',
    description:
      'All 54 detected stickers are validated for color parity and assembled into an exact 3D digital twin. The Kociemba two-phase solver computes a concise step-by-step solution.',
    icon: Layers,
  },
  {
    num: '03',
    title: 'Solve',
    subtitle: 'Follow animated, step-by-step instructions',
    description:
      'Put your camera aside and follow the 3D coach at your own pace. Each move highlights the active layer, displays curved directional arrows, and counts down automatically.',
    icon: Box,
  },
];

const TECH_STACK = [
  {
    name: 'YOLO Object Detection',
    role: 'Sticker Localization & Color Classification',
    metric: '54 tiles · < 18ms inference',
    description:
      'Fine-tuned single-stage detector trained across varied lighting, cube plastic finishes, and hand occlusions to localize all nine stickers per face with per-tile confidence scoring.',
    span: 'lg:col-span-2',
  },
  {
    name: 'Computer Vision Pipeline',
    role: 'Temporal Stability & Grid Mapping',
    metric: '9/9 frame consensus',
    description:
      'Spatial grid sorting and multi-frame stability filtering eliminate false captures when rotating the cube between faces.',
    span: 'lg:col-span-1',
  },
  {
    name: 'Kociemba Algorithm',
    role: 'Two-Phase Optimal Solver',
    metric: '≤ 22 moves average',
    description:
      'Validates cube state solvability (corner twist, edge flip, permutation parity) and generates beginner-friendly move sequences.',
    span: 'lg:col-span-1',
  },
  {
    name: 'Three.js & Interactive 3D',
    role: 'Real-Time Digital Twin Guidance',
    metric: '60 fps PBR studio scene',
    description:
      'Physically based cubie materials, curved 3D turn indicators, and automatic virtual camera framing keep every move unmistakable from any angle.',
    span: 'lg:col-span-2',
  },
];

export function LandingScreen() {
  const initialCube = useRubikStore((s) => s.initialCube);
  const startFreshScan = useRubikStore((s) => s.startFreshScan);
  const startInteractiveDemo = useRubikStore((s) => s.startInteractiveDemo);

  const [heroView, setHeroView] = React.useState<'vision' | 'twin'>('vision');

  // Subtle automatic showcase cycle between Physical Vision Scan and Reconstructed Digital Twin
  React.useEffect(() => {
    const timer = window.setInterval(() => {
      setHeroView((prev) => (prev === 'vision' ? 'twin' : 'vision'));
    }, 6500);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 w-full border-b border-zinc-800/70 bg-[#09090B]/95">
        <div className="max-w-[1280px] mx-auto h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-8">
          <BrandMark />

          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-8 text-sm text-zinc-400"
          >
            <a
              href="#how-it-works"
              className="hover:text-zinc-100 transition-colors whitespace-nowrap shrink-0"
            >
              How It Works
            </a>
            <a
              href="#technology"
              className="hover:text-zinc-100 transition-colors whitespace-nowrap shrink-0"
            >
              Technology
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-zinc-100 transition-colors whitespace-nowrap shrink-0"
            >
              GitHub
            </a>
          </nav>

          <div className="flex items-center shrink-0">
            <Button size="sm" onClick={() => startFreshScan(false)}>
              Start Solving
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b border-zinc-800/60">
          {/* Subtle atmospheric radial glow behind 3D cube */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-[12%] -translate-y-1/2 w-[540px] h-[540px] rounded-full opacity-25 blur-3xl"
            style={{
              background:
                'radial-gradient(circle, rgba(52,211,153,0.28) 0%, rgba(16,185,129,0.06) 50%, transparent 72%)',
            }}
          />

          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 lg:py-24">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">
              {/* Left Copy Column */}
              <div className="lg:col-span-6 space-y-6">
                <p className="font-mono text-xs tracking-[0.16em] text-emerald-400 uppercase">
                  Computer Vision × Interactive 3D
                </p>

                <div className="space-y-3">
                  <h1 className="text-[clamp(2.5rem,4.6vw,4.15rem)] font-bold tracking-[-0.03em] leading-[1.06] text-zinc-50">
                    Your Cube. Our Vision.
                  </h1>
                  <p className="text-xl sm:text-2xl font-medium tracking-tight text-zinc-300">
                    Solve any valid 3×3 Rubik’s Cube with AI.
                  </p>
                </div>

                <p className="text-base text-zinc-400 leading-relaxed max-w-xl">
                  Show all six faces of your scrambled cube to your webcam. RubikVision detects
                  every sticker in real time, builds a matching 3D digital twin, and coaches you
                  move by move until every face is solved.
                </p>

                <div className="flex flex-wrap items-center gap-3.5 pt-2">
                  <Button size="lg" onClick={() => startFreshScan(false)}>
                    <Camera className="h-4 w-4" />
                    Scan My Cube
                  </Button>
                  <Button
                    size="lg"
                    variant="secondary"
                    onClick={startInteractiveDemo}
                  >
                    <Play className="h-4 w-4 text-emerald-400" />
                    Try Interactive Demo
                  </Button>
                </div>

                <div className="pt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-500 font-mono tabular-nums">
                  <span>6 faces auto-captured</span>
                  <span aria-hidden="true">·</span>
                  <span>54-sticker validation</span>
                  <span aria-hidden="true">·</span>
                  <span>Kociemba 2-phase solver</span>
                </div>
              </div>

              {/* Right 3D Hero Visualization */}
              <div className="lg:col-span-6">
                <div className="relative rounded-2xl bg-[#111113] border border-zinc-800/80 overflow-hidden aspect-[4/3] sm:aspect-[16/12] lg:aspect-[5/4] shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
                  {/* Subtle studio grid backdrop */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 opacity-[0.14]"
                    style={{
                      backgroundImage:
                        'linear-gradient(to right, #27272a 1px, transparent 1px), linear-gradient(to bottom, #27272a 1px, transparent 1px)',
                      backgroundSize: '36px 36px',
                    }}
                  />

                  {/* Interactive 3D Scrambled Cube */}
                  <RubiksCube3D
                    cubies={initialCube}
                    mode="hero"
                    heroTwinWireframe={heroView === 'twin'}
                    className="relative z-10 w-full h-full"
                  />

                  {/* Subtle YOLO Bounding Boxes Overlay (active in Physical Scan view) */}
                  <div
                    aria-hidden="true"
                    className={cn(
                      'pointer-events-none absolute inset-0 z-20 transition-opacity duration-500',
                      heroView === 'vision' ? 'opacity-100' : 'opacity-0'
                    )}
                  >
                    {/* Fine corner brackets framing the cube */}
                    <div className="absolute top-10 left-12 w-7 h-7 border-t-2 border-l-2 border-emerald-400/50 rounded-tl-sm" />
                    <div className="absolute top-10 right-12 w-7 h-7 border-t-2 border-r-2 border-emerald-400/50 rounded-tr-sm" />
                    <div className="absolute bottom-14 left-12 w-7 h-7 border-b-2 border-l-2 border-emerald-400/50 rounded-bl-sm" />
                    <div className="absolute bottom-14 right-12 w-7 h-7 border-b-2 border-r-2 border-emerald-400/50 rounded-br-sm" />

                    {/* Subtle vertical scan line */}
                    <div className="absolute inset-x-12 top-10 bottom-14 overflow-hidden">
                      <div className="w-full h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent animate-scan-sweep" />
                    </div>

                    {/* Sticker detection boxes with JetBrains Mono class + confidence */}
                    {HERO_DETECTIONS.map((box) => (
                      <div
                        key={box.id}
                        className="absolute rounded-[4px] border border-emerald-400/75 bg-emerald-400/[0.04]"
                        style={{
                          top: box.top,
                          left: box.left,
                          width: box.w,
                          height: box.h,
                        }}
                      >
                        <span className="absolute -top-4 left-0 font-mono text-[10px] leading-none text-emerald-300 bg-[#09090B]/90 px-1 py-0.5 rounded-[3px] tabular-nums whitespace-nowrap">
                          {box.label} {box.conf}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Interactive Mode Switcher at Bottom of 3D Stage */}
                  <div className="absolute bottom-3.5 inset-x-4 z-30 flex items-center justify-between gap-3">
                    <span className="text-xs text-zinc-400 font-mono tabular-nums hidden sm:inline">
                      {heroView === 'vision'
                        ? 'YOLO Sticker Detection · 98.4% avg'
                        : 'Reconstructed 3D Digital Twin · 54/54 valid'}
                    </span>

                    <div
                      role="tablist"
                      aria-label="Hero visualization mode"
                      className="inline-flex items-center p-1 rounded-lg bg-[#09090B]/90 border border-zinc-800 ml-auto"
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={heroView === 'vision'}
                        onClick={() => setHeroView('vision')}
                        className={cn(
                          'px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5',
                          heroView === 'vision'
                            ? 'bg-zinc-800 text-zinc-100'
                            : 'text-zinc-400 hover:text-zinc-200'
                        )}
                      >
                        <ScanLine className="h-3.5 w-3.5 text-emerald-400" />
                        Scanned Cube
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={heroView === 'twin'}
                        onClick={() => setHeroView('twin')}
                        className={cn(
                          'px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5',
                          heroView === 'twin'
                            ? 'bg-zinc-800 text-zinc-100'
                            : 'text-zinc-400 hover:text-zinc-200'
                        )}
                      >
                        <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                        Digital Twin
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="border-b border-zinc-800/60">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
              <div className="space-y-2">
                <p className="text-xs font-mono text-emerald-400 tracking-wider uppercase">
                  Workflow
                </p>
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-50">
                  From physical scramble to solved cube in three steps
                </h2>
              </div>
              <p className="text-sm text-zinc-400 max-w-md">
                Designed for first-time solvers. No memorized algorithms or cryptic cube notation
                required.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-800/80 border-y border-zinc-800/80">
              {HOW_IT_WORKS_STEPS.map((step) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.num}
                    className="py-8 md:py-10 md:px-8 first:md:pl-0 last:md:pr-0 flex flex-col justify-between gap-5"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm text-emerald-400 tabular-nums">
                          {step.num}
                        </span>
                        <Icon className="h-5 w-5 text-zinc-500" />
                      </div>
                      <div className="space-y-1.5">
                        <h3 className="text-xl font-semibold text-zinc-100">{step.title}</h3>
                        <p className="text-sm font-medium text-zinc-300">{step.subtitle}</p>
                      </div>
                      <p className="text-sm text-zinc-400 leading-relaxed">{step.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Technology Showcase */}
        <section id="technology">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
              <div className="space-y-2">
                <p className="text-xs font-mono text-emerald-400 tracking-wider uppercase">
                  Architecture
                </p>
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-50">
                  Engineered for visual precision
                </h2>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                <Cpu className="h-4 w-4 text-emerald-400" />
                <span>YOLO · Computer Vision · Kociemba · Three.js</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {TECH_STACK.map((item) => (
                <div
                  key={item.name}
                  className={cn(
                    'rounded-xl bg-[#111113] border border-zinc-800/80 p-6 flex flex-col justify-between gap-6',
                    item.span
                  )}
                >
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between gap-4">
                      <h3 className="text-base font-semibold text-zinc-100">{item.name}</h3>
                      <span className="font-mono text-xs text-emerald-400 tabular-nums shrink-0">
                        {item.metric}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500">{item.role}</p>
                  </div>
                  <p className="text-sm text-zinc-400 leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>

            {/* Bottom Conversion Strip */}
            <div className="mt-14 pt-10 border-t border-zinc-800/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div>
                <h3 className="text-lg font-semibold text-zinc-100">
                  Ready to solve your cube?
                </h3>
                <p className="text-sm text-zinc-400 mt-1">
                  Start a guided webcam scan or explore a reconstructed scramble right away.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={() => startFreshScan(false)}>
                  Scan My Cube
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={startInteractiveDemo}>
                  Try Demo
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-zinc-800/70 py-8">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <div className="flex items-center gap-4">
            <BrandMark />
            <span aria-hidden="true">·</span>
            <span>AI-Powered Rubik’s Cube Coach</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#how-it-works" className="hover:text-zinc-300 transition-colors">
              How It Works
            </a>
            <a href="#technology" className="hover:text-zinc-300 transition-colors">
              Technology
            </a>
            <button
              type="button"
              onClick={() => startFreshScan(false)}
              className="hover:text-zinc-300 transition-colors cursor-pointer"
            >
              Start Scan
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
