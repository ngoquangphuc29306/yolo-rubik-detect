# RubikVision — Phase 0 + Phase 1 Implementation Plan: Frontend Baseline & Refactor

Date: 2026-11-19 · Revision 2 (incorporates `docs/FRONTEND_PLAN_REVIEW.md` B1–B7 and all important items, and your decisions D1–D7) · Status: **PROPOSED — awaiting approval. No code, dependency, config or git changes have been made.**
Inputs: `docs/ARCHITECTURE.md` (v1.0, read in full), `docs/RUBIKVISION_CLAUDE_HANDOFF.md` (read in full), `docs/FRONTEND_PLAN_REVIEW.md`, updated `CLAUDE.md`, every file under `src/` (read), `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `.env.example`, `metadata.json`.
Scope: Phase 0 (baseline verification) and Phase 1 (frontend refactor, still explicit demo). **Out of scope:** backend, model download/training, any rewrite of the UI or the Three.js scene. Execution stops after Phase 1.

> Honesty note: nothing in this plan has been executed. Statements about current behaviour come from reading source. Anything marked **[verify]** must be confirmed by running code in Phase 0 before it is relied on.

---

## 0. Decisions (resolved by the user) and revision log

### 0.1 Resolved decisions

| # | Decision | Resolution (user) | Consequences in this plan |
|---|---|---|---|
| D1 | Landing "Try Interactive Demo" | **A** — keep the direct shortcut to Reconstruction in demo mode | The simulated scan walk-through stays reachable through an explicit "Walk through the simulated scan" link on Landing (T1.16). |
| D2 | Package manager | **B — npm.** Package-manager migration and a new `package-lock.json` approved | **Baseline deviation, to be documented in the Phase 0 report:** Bun was not installed, so the `bun.lock` versions cannot be honoured; `npm install` resolves versions fresh. Installed versions are recorded verbatim (`npm ls --depth=0`) and `package-lock.json` becomes the reproducibility anchor. `bun.lock` stays in the untouched baseline commit and is deleted in T1.1 (after the Phase 0 gate). Never mix managers; use `npm ci` after the lockfile exists. |
| D3 | Prev/Next dock controls | **B** — remove both | Dock = Play/Pause, Replay, Pace slider, camera lock, sound. "Scan Again" stays in the header link and the Lost-track dialog. **No `SKIP_WAIT` event.** Dialog's "Step Back & Replay" becomes "Replay current move". |
| D4 | Git | **A**, superseded by the user's *Updated Git Workflow*: the user initialized the repo and made baseline commit `ad7c23b` on `main` themselves. One branch per phase (`chore/phase-0-baseline`, `refactor/phase-1-frontend`, `feat/phase-2-backend`, `feat/phase-3-vision`, `feat/phase-4-integration`, `ml/phase-5-training`, `feat/phase-6-model-integration`); each phase merges into `main` only after its gate **and** explicit user approval. No remotes, no pushes, no destructive Git operations. | T0.1 adapted: audit the existing baseline commit and ignore rules, make the snapshot; no `git init`, and the baseline commit is not recreated. |
| D5 | Browser regression | **A** — manual | T0.4 first checks that a supported browser is actually available; if not, the step is reported as **NOT RUN** with the limitation, never as passed. |
| D6 | Test dependencies | Accept compatible ones only | `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`; versions chosen in T1.2 from peer ranges after Phase 0 installs cleanly. Nothing else added. |
| D7 | Architecture doc location | Keep `docs/ARCHITECTURE.md` | Amend its §10 tree (T1.20). |

Authorization boundary: approving *this plan* authorizes Phase 0 on `chore/phase-0-baseline` (audit, snapshot, `npm install`, lockfile commit) and, after the Phase 0 gate, Phase 1. It does not authorize Phase 2+.

### 0.2 Revision log — independent review (`docs/FRONTEND_PLAN_REVIEW.md`)

| Review item | Resolution | Where |
|---|---|---|
| **B1** RESET / generation | RESET is the only privileged event: accepted iff `event.generation > state.generation`; it fully re-initializes; same-or-older-generation RESET and every non-RESET event with `generation ≠ state.generation` are no-ops. `displayedSnapshotIndex` is exactly 0 for `total=0`, `idle`, and clamped to `[0,total]` always. | §2.1, §6.4, T1.9 |
| **B2** per-move durations, clock, overshoot | RESET takes `moves: readonly MoveToken[]`; durations derived (`R`=780 ms, `F2`=975 ms) and stored immutably; replay uses the same per-move duration. TICK carries overshoot across phase boundaries (no elapsed time dropped; splitting a tick arbitrarily yields the same state). Single rAF clock in the hook; the renderer is controlled. | §2.1, §6.4, T1.9–T1.11 |
| **B3** legacy migration order | Legacy `lib/cubeEngine.ts` and `store/useRubikStore.ts` stay in production until the last consumer is migrated; a temporary **compat facade** keeps unmigrated screens working on the *new* stores (no second source of truth); deletion happens in its own task **T1.17** guarded by grep + typecheck + tests. Legacy-derived characterization data is frozen as literal JSON goldens before any differential test is retired. Every commit must build; `strict`/test gates apply from T1.2. | §3, §7 (T1.5, T1.8, T1.17) |
| **B4** solve request↔response binding | New pure `bindSolveResponse(request, response)`: recompute canonical state and centre colours from the *request*, require `response.initialState` and `response.centerColors` to equal them, require `moveCount === moves.length`, then replay-to-solved. Mismatch ⇒ typed client error, playback never enabled. | §2.1, §6.2, §6.5, T1.4c, T1.15 |
| **B5** provenance vs strict schema | Wire `SolveResponse` is untouched (strict parser rejects extra keys). Provenance lives in a client wrapper `SolveOutcome { response, source }`. Client-only error union (`RESPONSE_MISMATCH`, `SOLUTION_REPLAY_MISMATCH`, `REQUEST_CANCELLED`, …) is separate from server `ApiErrorCode`. | §2.1, §5, §6.3, T1.6–T1.7 |
| **B6** safe Git baseline | T0.1 rewritten: audit first, minimal ignore hardening documented as a housekeeping exception, snapshot that cannot overwrite, explicit staged-file review, no secrets. | T0.1 |
| **B7** async lifecycle | `lib/request-guard.ts` (per-request id + `AbortController` + `isCurrent()`) used by health, solve and camera acquisition; late `getUserMedia` resolution after teardown stops every returned track immediately; StrictMode double-mount tested. | §6.5, §6.6, T1.8, T1.14, T1.15 |
| Reference provenance | Reference tables are fetched from a pinned upstream commit with URL, SHA, licence and date recorded — **never written from memory**; goldens are not generated by the implementation under test; Python `kociemba` cross-check deferred to Phase 2. | T1.4a, §6.2 |
| Elapsed semantics | Displayed metric renamed **Guidance time** (accumulated playback time), explicitly *not* wall-clock; per-frame dt cap 250 ms is documented; reference timestamp reset on start/resume/visibility return; hidden tab never advances steps. | §2.1, §6.4, T1.10, T1.13 |
| Orientation guidance | A minimal always-visible **orientation cue** (Top / Front / Right centre colours + current target centre and direction) is kept in Phase 1; only the dynamic camera redesign is deferred. Manual checks cover an asymmetric R/U/F, B/D sequence with expected visual direction per move. | T1.12, §6.7 |
| Readiness with fixture mode | Pure `deriveLiveReadiness(health)` returns `blocked \| fixture-only \| ready`; `fixture-only` is visibly labelled and never enables unlabelled live capture. Phase 1 has no transport, so live capture stays blocked regardless. | §5, T1.6 |
| Checkbox RED→GREEN tasks | §7 rewritten with `- [ ]` steps; mechanical relocation and baseline characterization are explicitly exempt from forced-failing tests. | §7 |
| Architecture churn | Four stores → **three** (playback settings folded into `session-store`); playback *state* is not a store; no empty directories; `features/cube/` not created; one authoritative `FaceletState`. | §2 |
| Cross-references | T0.4→T0.3 corrected (S5, migration table); T0.3 added to the Phase 0 gate; final report records the actual package manager, commands and installed versions. | S5, §3, T0.5, T1.19 |

---

## 1. Findings from the existing codebase

Repo: Vite + React 19 + TS + Tailwind 4 + Zustand + R3F. 5,839 lines in `src/`. No tests, no git, no `node_modules`, no backend. Six screens switched by `store.screen` (no router).

### 1.1 Positive findings (preserve)
- **The cubie engine is already consistent with ARCHITECTURE §6.4/§7.2.** By reading: `extractFaceGrid` (`cubeEngine.ts:375-408`) row/column order matches the §6.4 table for all six faces (F: x asc / y desc; B: x desc; R: z desc; L: z asc; U rows z asc; D rows z desc), and `parseMove` angles (`:224-230`) match §7.2 (R −90° about X, L +90°, U −90° about Y, D +90°, F −90° about Z, B +90°). Phase 1 turns "by reading" into "by test".
- UI quality, six-screen flow, layout, animations, `RubiksCube3D` rendering (RoundedBox cubies, MoveArrow3D, PMREM environment, contact shadow, WebGL context-loss recovery) are good and are **not** redesigned.

### 1.2 Defects, mapped to handoff P0 items (line numbers are from the current files)

| ID | Handoff P0 | Evidence | Fix (task) |
|---|---|---|---|
| F1 | Simulated scanning / fake confidence | `ScanningScreen.tsx:37` hard-coded `STICKER_CONFIDENCES`; `:158-176` detected count/“98.2%” derived from a dropdown state; `:83-89` fake 1150 ms "Loading Vision Model"; `:106-119` stability = +6 % every 140 ms timer; `:306-361` overlay boxes drawn from `targetFaces` | T1.14 |
| F2 | Real webcam with fake detections | `:249-255` real `<video>` shown with the **simulated** boxes over it, `object-cover` + `scale-x-[-1]` (mirrored, crops → overlay coordinates impossible); no frame transport | T1.14 |
| F3 | Capture copies the preset | `useRubikStore.ts:191-199` `captureCurrentFace` stores `targetFaces[face]` regardless of any observation | T1.8, T1.14 |
| F4 | Reconstruction fabricates/force-fills | `ReconstructionScreen.tsx:45-51` merges missing faces from `targetFaces`; `:54-73` checklist is a timer, not validation; `:339-358` "54/54", "Valid", "Kociemba solution N moves" are unconditional; `:83-91` "Test Invalid Cube State" flag with a hard-coded reason (`useRubikStore.ts:270-277`) | T1.15 |
| F5 | Solution is not a solver output | `cubeEngine.ts:427-446` solution = reversed scramble of 3 presets, labelled "Kociemba" in UI copy | T1.7 (explicit demo fixture), T1.15 copy |
| F6 | Hard-coded orientation | `cubeEngine.ts:186-191` fixed G/B/R/O/W/Y; `FACE_META.defaultCenter` (`:79-146`) and scan copy "until the **red** center faces the camera" (`:97,108,119`); `ScanningScreen.tsx:178-184` expected centre = `defaultCenter`; lock-camera tooltip "Green Front · White Top · Red Right" (`SolvingScreen.tsx:552`); `CompletionScreen.tsx:17,112` always-solved fixed-colour cube | T1.3, T1.5, T1.12-14 |
| F7 | Silent colour substitution | `cubeEngine.ts:379` `?? 'W'`; `:423` `?? defaultCenter` | T1.5 (throws / returns error) |
| F8 | Animation ignores pause | `RubiksCube3D.tsx:423-440` rotation advances in `useFrame` and fires `onComplete` independent of `isPlaying`; pause freezes only the countdown | T1.9-1.11 |
| F9 | Playback timer unreliable | `SolvingScreen.tsx:97-103` elapsed = count of 1 s `setInterval` ticks (drifts, throttled in background tabs); `:106-114` effect depends on `[clampedStep]` but reads `moveDelaySeconds`/`soundEnabled` (stale closure); `:123-141` countdown = 100 ms interval decrement; no hidden-tab handling | T1.9-1.12 |
| F10 | Replay/step-back races | `SolvingScreen.tsx:605-609` dialog calls `setCurrentStepIndex(clampedStep-1)` then `handleReplayMove()` in the same tick with the **old** `clampedStep`; `:210-233` Prev/Next reset phases ad hoc; `:219-232` Next bypasses the delay | T1.9, T1.12 |
| F11 | Empty solution | `SolvingScreen.tsx:58` `clampedStep = max(0, min(step, total-1))` → `-1→0`; `currentMoveNotation` undefined; `:239-241` `/ totalSteps` → NaN/Infinity; `AlignmentScreen.tsx:93` "Start" with 0 moves enters Solving | T1.9, T1.12, T1.13 |
| F12 | Stale callbacks after rescan | `startFreshScan(true)` (`store:132-153`) resets indices but there is no session token; timeouts/intervals in screens (`ScanningScreen:92-103`, `SolvingScreen:149-155`) and `onComplete` from the renderer are not generation-guarded; `finishAfterAnimRef` (`SolvingScreen:94,187-197`) survives step changes | T1.8-1.12 |
| F13 | Completion accuracy | `CompletionScreen.tsx:84` `Math.max(elapsed, solution.length*4)` pads time; `:73-76` auto-confetti on arrival; `:213` "Solve confirmed across all 54 stickers" copy; `:112` renders a fresh hard-coded solved cube not the session's cube | T1.13 |
| F14 | Auto-start of solving | `store.resetSolveSession` sets `isPlaying: true` and `screen: 'solving'`; the Alignment "Start" button is the deliberate start, which is OK — but `Solving` entered from Completion "replay" (`CompletionScreen`) also auto-plays | T1.12 (explicit Start semantics preserved: entering Solving from Alignment/Completion = one deliberate click) |

### 1.3 Scaffold / configuration findings

| ID | Finding | Evidence | Action |
|---|---|---|---|
| S1 | `tsconfig.json` has **no `strict`** (so `strictNullChecks` etc. are off), plus `allowJs`, `experimentalDecorators`, `useDefineForClassFields:false` leftovers. `npm run lint` = `tsc --noEmit` therefore under-reports. | `tsconfig.json` | Phase 0 records current result; T1.2 enables `strict` and fixes fallout |
| S2 | Alias `@` → project root, imports are `@/src/...`; asset referenced as string `'/src/assets/images/webcam…jpg'` (`ScanningScreen.tsx:33`) and rescued by a custom `closeBundle` copy plugin | `vite.config.ts:11-27,33-35` | `@` → `./src`; `import img from '@/assets/...'`; remove plugin **after** prod asset verified (T1.1, T1.18) |
| S3 | AI Studio-only HMR/watch toggling ("Do not modify") | `vite.config.ts:36-41` | Remove (T1.18) |
| S4 | Dev server binds `0.0.0.0` on port 3000 (`dev` script) — violates ARCHITECTURE §11 | `package.json:7` | `127.0.0.1:5173`, proxy `/api`,`/health`,`/ws` → `127.0.0.1:8000` (T1.18) |
| S5 | Unused declared deps: `@google/genai`, `dotenv`, `express`, `@types/express`, `motion`, `tsx`, `esbuild`, `autoprefixer` (Tailwind 4 via `@tailwindcss/vite`, no PostCSS config). `grep` of `src/` finds **no** import of any of them. | grep (done once while planning; **re-run as evidence in T0.3**) | Remove in T1.18 only if T0.4 evidence holds |
| S6 | **Phantom dependency**: `RubiksCube3D.tsx:6` imports types from `three-stdlib`, which is not in `package.json` (only transitive via drei) | file | Replace with `React.ElementRef<typeof OrbitControls>` (T1.11) |
| S7 | `clean` script uses `rm -rf` (not Windows-portable); `name: react-example`; README/.env.example/metadata.json are AI Studio/Gemini boilerplate (Gemini key not used anywhere) | files | T1.18 |
| S8 | `index.html` loads Google Fonts at runtime (third-party request) | `index.html:15-20` | Keep for UI parity; note as follow-up (self-host) in README. Not a Phase 1 change. |
| S9 | `package.json` pins very new majors (TypeScript ^7.0.2, Vite ^8.3.0, `@vitejs/plugin-react` ^6.1.1, three/@types/three ^0.187) | `package.json` | Phase 0 must actually install and build before we trust them; test-runner versions picked to match |

### 1.4 What I could not determine from reading
Whether the baseline installs, type-checks or builds; actual WebGL rendering; mobile layout quality. All settled in Phase 0.

---

## 2. Target architecture for Phase 1

Layering rule (enforced by import review, and by a lint test in T1.2): `engine/` and `demo/` and `types/` import **nothing** from React, Three, the DOM or stores. `services/` imports only `types/`. `stores/` import `engine/`, `services/`, `types/`. `hooks/` import stores/engine. `features/` and `components/` import everything below them.

```text
rubik-solver-yolo/                      # repo root
  docs/  (ARCHITECTURE.md, handoff, superpowers/{plans,reports})
  README.md  .gitignore
  fixtures/                             # shared, language-neutral contract fixtures (JSON)
    solve/{solved.request.json, solved.response.json, scrambleA.*.json, invalid-*.json}
    health/{ok.json, model-unavailable.json}
  frontend/
    package.json  <lockfile>  vite.config.ts  tsconfig.json  vitest.config.ts  index.html  .env.example
    src/
      main.tsx  App.tsx  index.css
      assets/images/webcam_cube_hands_1795070971051.jpg
      types/{cube.ts, api.ts, scan.ts}
      engine/
        cube-state.ts        # FaceletState parse/validate/serialize, centers, color mapping helpers
        move-engine.ts       # applyMove (facelet permutation), buildSnapshots, verifySolution, parseMoveToken
        facelet-geometry.ts  # §6.4 table: face -> (n, a, b), facelet index <-> (cubie pos, normal)
        cubie-adapter.ts     # toCubies(state, centerColors) -> CubieState[]  (renderer-only derived model)
        playback-fsm.ts      # pure reducer; no timers
        move-presentation.ts # parseMove(): axis/layer/angle/natural language (copied from cubeEngine)
        solve-binding.ts     # bindSolveResponse(request, response): state + centres + replay binding
      demo/
        demo-fixtures.ts     # DEMO_CENTER_COLORS, 3 scrambles, DEMO_SOURCE marker
        demo-solver.ts       # returns SolveOutcome { response: strict SolveResponse, source:'demo-fixture' }
        demo-scan-source.ts  # scripted simulated scan conditions (the old SIMULATED_CONDITIONS)
      services/
        api-config.ts        # base URLs (relative; Vite proxy)
        health-client.ts     # GET /health + strict parse
        solver-client.ts     # POST /api/solve + strict parse + AbortSignal + typed ApiError
        scan-transport.ts    # ScanTransport interface + UnavailableScanTransport (WS impl is Phase 4)
        parsers.ts           # runtime validators for HealthResponse, SolveResponse, ApiErrorEnvelope
      stores/
        session-store.ts     # mode (demo|live), screen, sessionId (generation), settings, startSession/reset
        scan-store.ts        # stage, faceStatuses, capturedFaces (CapturedFace[]), scan condition
        cube-store.ts        # solveState: idle|solving|ready|error; centerColors, initialState, moves, snapshots
                             # (playback settings — delay, sound — live in session-store; playback STATE is the pure
                             #  reducer in engine/ driven by usePlayback, not a global store)
      hooks/
        useCamera.ts         # getUserMedia lifecycle, track stop, error classification
        usePlayback.ts       # rAF clock + visibility + generation guard around playback-fsm
        useSolveSession.ts   # orchestrates solve request, response binding, replay verification, stale-result guard
        useBackendHealth.ts  # polls/gets /health, exposes live-readiness
      lib/{utils.ts, audio.ts, contain-transform.ts, colors.ts, request-guard.ts}
      components/
        BrandMark.tsx WorkspaceHeader.tsx FaceGrid2D.tsx ModeBanner.tsx
        ui/{button,dialog,progress,slider,switch}.tsx
        three/{RubiksCube3D.tsx, webglUtils.tsx}
      features/
        landing/LandingScreen.tsx
        scanner/{ScanningScreen.tsx, ScanViewport.tsx, ScanGuidePanel.tsx, CapturedFacesPanel.tsx,
                 ScanSettingsDialog.tsx, scan-guide.ts, LiveUnavailablePanel.tsx}
        review/ReconstructionScreen.tsx
        align/AlignmentScreen.tsx
        solver/{SolvingScreen.tsx, CompletionScreen.tsx, PlaybackDock.tsx, MoveInfoPanel.tsx, CountdownRing.tsx}
    tests/                              # unit + component tests mirror src/
```

Decision on Three components: stay at `components/three/` (single location, per handoff §3 row 56).
Directories are created only when their first file exists (no empty folders). Four stores and six engine files were proposals, not requirements: playback *state* is a pure reducer (no store) and playback settings fold into `session-store`. `features/cube/` from the handoff tree is **not created** in Phase 1 (nothing to put there that is not `engine/`+`components/three/`); noted in amendments.

### 2.1 Core TypeScript interfaces (normative for Phase 1; mirror ARCHITECTURE §6.4, §7.1, §8)

```ts
// types/cube.ts
export type FaceId = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';                 // direction, NOT a colour
export const SOLVER_FACE_ORDER: readonly FaceId[] = ['U','R','F','D','L','B'] as const;   // state order URFDLB
export const SCAN_FACE_ORDER:   readonly FaceId[] = ['F','R','B','L','U','D'] as const;   // capture order
export type ColorName = 'white' | 'yellow' | 'red' | 'orange' | 'blue' | 'green';          // API vocabulary
export type CenterColors = Readonly<Record<FaceId, ColorName>>;
export type FaceletState = string & { readonly __brand: 'FaceletState54' };               // 54 chars of URFDLB
export type MoveToken = `${FaceId}` | `${FaceId}'` | `${FaceId}2`;                         // exactly 18
export type FaceGrid = readonly [ColorName, ColorName, ColorName, ColorName, ColorName,
                                 ColorName, ColorName, ColorName, ColorName];              // row-major
export type SixFaces = Readonly<Record<FaceId, FaceGrid>>;

// types/api.ts  (wire contracts, schemaVersion 1 — identical to ARCHITECTURE §8.2/§8.3 + handoff §2 health additions)
export interface SolveRequest  { schemaVersion: 1; faces: Record<FaceId, ColorName[]>; }
export interface SolveResponse { schemaVersion: 1; centerColors: CenterColors; initialState: string;
                                 moves: string[]; moveCount: number; }
// Server wire codes ONLY (ARCHITECTURE §8.3). Client-only failures are a separate union below.
export type ApiErrorCode = 'INVALID_FACE_SHAPE'|'DUPLICATE_CENTER'|'COLOR_COUNT_MISMATCH'|'INVALID_CUBE_STATE'
  |'SOLVER_TIMEOUT'|'MODEL_UNAVAILABLE'|'FRAME_TOO_LARGE'|'INVALID_FRAME';
export interface ApiErrorEnvelope { error: { code: ApiErrorCode; message: string; retryable: boolean } }
// Client-side only — never part of a wire payload (B5)
export type ClientErrorCode = 'NETWORK'|'BACKEND_UNAVAILABLE'|'BAD_RESPONSE'|'RESPONSE_MISMATCH'
  |'SOLUTION_REPLAY_MISMATCH'|'REQUEST_CANCELLED'|'REQUEST_INVALID';
export type SolveError =
  | { kind: 'api';    code: ApiErrorCode;    message: string; retryable: boolean }
  | { kind: 'client'; code: ClientErrorCode; message: string; retryable: boolean };
export type SolveProvenance = 'backend' | 'demo-fixture';
export interface SolveOutcome { readonly response: SolveResponse; readonly source: SolveProvenance } // provenance OUTSIDE the wire object
export type LiveReadiness =
  | { kind: 'ready' }                                   // detectorMode==='yolo' && visionReady && solverReady
  | { kind: 'fixture-only'; solverReady: boolean }      // labelled; never enables unlabelled live capture
  | { kind: 'blocked'; reason: 'MODEL_UNAVAILABLE' | 'BACKEND_UNAVAILABLE'; solverReady: boolean };
export function deriveLiveReadiness(h: HealthResponse | null): LiveReadiness;   // null = unreachable

export interface HealthResponse { schemaVersion: 1; status: 'ok'|'degraded'|'error'; detectorMode: 'fixture'|'yolo';
                                  visionReady: boolean; solverReady: boolean; modelVersion?: string; device?: string; error?: string }
export interface FrameResult { type:'frame_result'; schemaVersion:1; scanId:string; frameSeq:number; width:number; height:number;
  detections:{classId:number;color:ColorName;confidence:number;xyxy:[number,number,number,number]}[];
  grid: ColorName[] | null; quality:{valid:boolean; reason?:string}; inferenceMs:number }  // types only in Phase 1

// engine/*
export function parseFaceletState(state: string, centers: CenterColors): FaceletState;   // throws CubeStateError
export function applyMove(state: FaceletState, move: MoveToken): FaceletState;           // pure, O(54)
export function parseMoveToken(token: string): MoveToken;                                // throws on x/y/z/slices/wide
export function buildSnapshots(initial: FaceletState, moves: readonly MoveToken[]): readonly FaceletState[]; // length n+1
export function verifySolution(initial: FaceletState, moves: readonly MoveToken[]): { ok: true; snapshots: readonly FaceletState[] } | { ok: false; reason: string };
// empty moves are valid ONLY when `initial === SOLVED`; snapshots always has length moves.length+1
export function bindSolveResponse(request: SolveRequest, response: SolveResponse):
  { ok: true; state: FaceletState; centers: CenterColors; moves: readonly MoveToken[]; snapshots: readonly FaceletState[] }
  | { ok: false; code: 'RESPONSE_MISMATCH' | 'SOLUTION_REPLAY_MISMATCH' | 'REQUEST_INVALID'; reason: string };
// 1) buildFaceletState(request.faces) -> expected {state, centers}; 2) response.initialState === state && centerColors deep-equal;
// 3) moveCount === moves.length; 4) parse tokens; 5) verifySolution(). Playback is never enabled unless ok.
export const SOLVED: FaceletState;                                                       // 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB'
export function toCubies(state: FaceletState, centers: CenterColors): CubieState[];      // renderer adapter
export function facesFromState(state: FaceletState, centers: CenterColors): SixFaces;    // for review/2D nets
export function buildFaceletState(faces: SixFaces): { state: FaceletState; centers: CenterColors }; // scan -> canonical (fails closed)
```

`CubieState` (existing renderer type: `{id,x,y,z,stickers:Partial<Record<FaceKey,StickerColor>>}`) is retained **only** as the derived renderer representation. `StickerColor` (`'W'|'Y'|…`) stays a UI/renderer token; the single boundary `lib/colors.ts` maps `ColorName ↔ StickerColor`. `FaceKey` is replaced by `FaceId` (same literals).

```ts
// engine/playback-fsm.ts — pure: no timers, no DOM, no React
export const QUARTER_TURN_MS = 780;   // existing renderer duration (0.78 s)
export const HALF_TURN_MS    = 975;   // 780 × 1.25, existing behaviour for '2' moves
export const MIN_DELAY_MS = 2000;  export const MAX_DELAY_MS = 15000;
export function animDurationMs(move: MoveToken): number;  // move.endsWith('2') ? HALF_TURN_MS : QUARTER_TURN_MS

export type PlaybackStatus = 'idle' | 'animating' | 'waiting' | 'paused' | 'complete';
export interface PlaybackState {
  readonly generation: number;                 // owning session generation; 0 = never reset
  readonly status: PlaybackStatus;
  readonly pausedFrom: 'animating' | 'waiting' | null;
  readonly pauseReason: 'user' | 'hidden' | null;
  readonly animMs: readonly number[];          // per-move durations, fixed at RESET, length === total
  readonly total: number;
  readonly index: number;                      // move being demonstrated; 0 when total === 0
  readonly animElapsedMs: number;
  readonly waitElapsedMs: number;
  readonly waitTotalMs: number;                // fixed when the wait phase begins (= delayMs at that moment)
  readonly delayMs: number;                    // setting; applies from the NEXT wait phase
  readonly isReplay: boolean;
  readonly playbackMs: number;                 // dt applied while animating|waiting → "Guidance time" (NOT wall-clock)
}
export type PlaybackEvent =
  | { type: 'RESET';     generation: number; moves: readonly MoveToken[]; delayMs: number }
  | { type: 'START';     generation: number }
  | { type: 'TICK';      generation: number; dtMs: number }
  | { type: 'PAUSE';     generation: number; reason: 'user' | 'hidden' }
  | { type: 'RESUME';    generation: number }
  | { type: 'REPLAY';    generation: number }
  | { type: 'SET_DELAY'; generation: number; delayMs: number };           // no SKIP_WAIT (D3-B)
export function createPlaybackState(): PlaybackState;                      // generation 0, idle, total 0
export function playbackReducer(s: PlaybackState, e: PlaybackEvent): PlaybackState;
export function displayedSnapshotIndex(s: PlaybackState): number;          // always an integer in [0, total]
export function animationProgress(s: PlaybackState): number;               // animElapsed / animMs[index], 0..1, 0 unless animating|paused-from-animating
```

Behavioural spec (each line becomes at least one test in T1.9):

1. **RESET (privileged).** Accepted iff `e.generation > s.generation`. It rebuilds *every* field from the event: `animMs = moves.map(animDurationMs)`, `total = moves.length`, `index = 0`, all elapsed/`playbackMs` = 0, `isReplay=false`, `pausedFrom/pauseReason = null`, `delayMs = clamp(e.delayMs)`. `status = 'idle'` if `total > 0`, else `'complete'` (empty solution; nothing to play). A RESET with `generation ≤ s.generation` is a **no-op** (a stale or duplicate RESET can never wipe a newer session). To restart the same solution the caller bumps the generation.
2. **Generation guard.** Every non-RESET event with `e.generation !== s.generation` returns `s` unchanged (reference-equal).
3. **Snapshot indexing.** `displayedSnapshotIndex`: `total === 0` → 0; `idle` → 0; `animating` or `paused` with `pausedFrom==='animating'` → `index`; `waiting`, `paused` with `pausedFrom==='waiting'`, `complete` → `index + 1`. Result is always in `[0,total]`, so `snapshots[displayedSnapshotIndex(s)]` is defined for every reachable state, including `total` = 0 and 1.
4. **START.** Only from `idle` with `total > 0` → `animating`, `index 0`, `animElapsedMs 0`. Otherwise no-op (empty solution never starts).
5. **TICK semantics (overshoot-safe).** `dtMs` must be finite and ≥ 0 (else no-op). While `status ∈ {animating, waiting}` and `rest > 0`: apply `min(rest, remainingInPhase)`, add the applied amount to `playbackMs`, subtract from `rest`; when a phase fills, transition **immediately** and carry the leftover `rest` into the next phase. `animating`→`waiting` sets `waitTotalMs = delayMs`. `waiting`→`animating` increments `index`, or →`complete` if `index === total-1` (**the final wait always completes**). Leftover `rest` after `complete` is discarded and **not** added to `playbackMs`. Consequence tested as a property: `reduce(TICK a, TICK b) ≡ TICK (a+b)` for every split. `TICK` in `idle|paused|complete` returns `s`.
6. **Durations are per move.** `R`: animation phase = 780 ms; `F2`: 975 ms; replay of `F2` is again 975 ms; `animationProgress` divides by `animMs[index]`.
7. **PAUSE / RESUME.** `PAUSE` from `animating|waiting` → `paused`, `pausedFrom`, `pauseReason` recorded, both elapsed counters preserved; from any other status no-op. `RESUME` from `paused` → `pausedFrom` with counters intact; `pauseReason` cleared. `TICK` while paused changes nothing (including `playbackMs`).
8. **REPLAY.** From `animating | waiting | paused` → `animating`, same `index`, `animElapsedMs=0`, `isReplay=true`, `pausedFrom=null`. While replaying, the displayed state is `S[index]`; after it, `S[index+1]` with a fresh full wait. Nothing is committed, so a move can never be applied twice. Replay on the final move still ends in `complete` only after a full wait. `REPLAY` from `idle|complete` is a no-op.
9. **SET_DELAY.** Clamped to `[2000,15000]`; changes `delayMs` only — never `waitTotalMs` of an in-flight wait (applies next step, ARCHITECTURE §7.3).
10. **Invariants** (fast-check-style property test with a seeded PRNG, no new dependency): for any generation-valid event sequence and `total ∈ {0,1,2,5,18}`: `0 ≤ animElapsed ≤ animMs[index]`, `0 ≤ waitElapsed ≤ waitTotal`, `displayedSnapshotIndex ∈ [0,total]`, `playbackMs` non-decreasing and unchanged by `PAUSE`d ticks, `index ≤ max(total-1,0)`.

**Clock policy (hook, T1.10).** One `requestAnimationFrame` loop is the only clock. `dt = now - lastTs` using `performance.now()`; `lastTs` is **reset** on START, RESUME, REPLAY-from-pause and on return from hidden, so the first frame after any resume has `dt ≈ one frame`. Per-frame `dt` is capped at **250 ms** to survive an un-signalled suspend (laptop sleep, debugger); a longer *visible* stall therefore *truncates* playback time rather than fast-forwarding steps. Consequently `playbackMs` is a **simulated playback clock**, displayed only as "Guidance time", never as "time to solve". `visibilitychange → hidden` dispatches `PAUSE{reason:'hidden'}`; resume is always a deliberate user action.

---

## 3. Exact file migration mapping

Step 1 (T1.1) is **behaviour-preserving relocation only**: files move, `@/src/x` → `@/x`, asset becomes a module import. Splits/refactors come in later tasks.

| Current | T1.1 destination (move only) | Later change |
|---|---|---|
| `package.json`, `package-lock.json` (created T0.2, D2-B), `vite.config.ts`, `tsconfig.json`, `index.html`, `.env.example` | `frontend/` (same names). `bun.lock` is **deleted** in T1.1 (kept in the baseline commit) | cleaned in T1.18 |
| `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/assets/**` | `frontend/src/…` | App imports updated |
| `src/components/{BrandMark,WorkspaceHeader,FaceGrid2D}.tsx` | `frontend/src/components/` | re-pointed per screen (T1.12–T1.16) |
| `src/components/ui/*` | `frontend/src/components/ui/` | unchanged |
| `src/components/three/{RubiksCube3D,webglUtils}.tsx` | `frontend/src/components/three/` | T1.11 controlled progress, drop `three-stdlib` |
| `src/lib/utils.ts` | `frontend/src/lib/utils.ts` | audio helpers split to `lib/audio.ts` in T1.10 |
| `src/lib/cubeEngine.ts` | `frontend/src/lib/cubeEngine.ts` (**stays in production use until T1.17**) | T1.3–T1.5 add `types/cube.ts`, `engine/*`, `lib/colors.ts`, `features/scanner/scan-guide.ts` *additively*; legacy file deleted only in T1.17 after the last consumer migrated, grep + typecheck + tests are clean, and legacy-derived goldens are frozen as JSON (§6.1) |
| `src/store/useRubikStore.ts` | `frontend/src/store/useRubikStore.ts` | T1.8 turns it into a read-through **compat facade** over the new `stores/{session,scan,cube}-store.ts` (single source of truth); facade deleted in T1.17 |
| `src/screens/LandingScreen.tsx` | `frontend/src/features/landing/LandingScreen.tsx` | T1.16 |
| `src/screens/ScanningScreen.tsx` | `frontend/src/features/scanner/ScanningScreen.tsx` | T1.14 split into 6 files |
| `src/screens/ReconstructionScreen.tsx` | `frontend/src/features/review/ReconstructionScreen.tsx` | T1.15 |
| `src/screens/AlignmentScreen.tsx` | `frontend/src/features/align/AlignmentScreen.tsx` | T1.13 |
| `src/screens/SolvingScreen.tsx` | `frontend/src/features/solver/SolvingScreen.tsx` | T1.12 split |
| `src/screens/CompletionScreen.tsx` | `frontend/src/features/solver/CompletionScreen.tsx` | T1.13 |
| `README.md` | repo root, rewritten | T1.18 |
| `.gitignore` | repo root, extended | T0.1 (housekeeping exception) / T1.18 |
| `metadata.json` | `docs/legacy/ai-studio-metadata.json` **only if** T0.3 shows no runtime use | T1.18 |
| `docs/*` | unchanged | amendments T1.20 |

Note: Asset file name has an AI-Studio timestamp; it is kept (renaming is cosmetic and out of scope).

---

## 4. Files to create / modify / delete (summary)

**Create:** `types/{cube,api}.ts` (+`scan.ts` only if a consumer needs it); `engine/{cube-state,facelet-geometry,move-engine,move-presentation,solve-binding,cubie-adapter,playback-fsm}.ts`; `demo/*` (3); `services/*` (5); `stores/{session,scan,cube}-store.ts`; `hooks/{useCamera,usePlayback,useSolveSession,useBackendHealth}.ts`; `lib/{audio,contain-transform,colors,request-guard}.ts`; `components/ModeBanner.tsx`; scanner/solver sub-components (§2); `vitest.config.ts`, `tests/**` (§6, incl. `tests/reference/` and `tests/golden/`); `fixtures/**`; reports under `docs/superpowers/reports/`.
**Modify:** every screen (imports + data source), `RubiksCube3D.tsx`, `App.tsx`, `main.tsx` (none expected), `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html` (title unchanged), `README.md`, `.gitignore`, `.env.example`.
**Delete (after verification):** `bun.lock` (T1.1, D2-B); `lib/cubeEngine.ts` and the `useRubikStore` facade (**only in T1.17**, after grep/typecheck/tests are clean); unused dependencies (S5) with T0.3 evidence; AI Studio `closeBundle` plugin and HMR toggles (T1.18).
**Do not touch:** CSS tokens/theme in `index.css`, ui primitives, `webglUtils.tsx`, visual structure of screens, `RubiksCube3D` materials/lighting/arrow.

---

## 5. Mode separation (Demo vs Live)

`session-store.mode: 'demo' | 'live'` is set only on Landing and cannot change mid-session (switching = new session).

| Concern | Demo | Live |
|---|---|---|
| Entry | "Try Interactive Demo" | "Start Scanning" |
| Banner | Persistent amber **"DEMO — simulated scan data. Not a camera reading."** in `WorkspaceHeader` (`ModeBanner`) | none; shows backend status chip instead |
| Scan viewport | Existing stock photo + scripted overlay, labelled "Simulated feed"; confidences removed from labels (shows colour code only, no numeric confidence in demo — numbers were fabricated). The condition picker ("Simulate Computer Vision State") stays, Demo only | Real `<video>`, **unmirrored**, `object-contain`; **no overlay boxes ever** unless they come from a `FrameResult`. Phase 1 has no transport, so live shows `LiveUnavailablePanel` ("Vision service not connected") and disables capture |
| Real webcam toggle | Removed in demo (no fake boxes on real video) | Camera permission/preview/stop lifecycle only |
| Capture | Fixture grid, `source:'demo'` | Blocked in Phase 1 (health says no vision, no transport) |
| Solve | `demo-solver.ts` → `SolveOutcome{ response: strict SolveResponse, source:'demo-fixture' }` (provenance is **outside** the wire object, B5), UI copy "Demo solution (reverse of scramble)" — **never** "Kociemba" | `solver-client` → `POST /api/solve`; backend absent ⇒ typed `BACKEND_UNAVAILABLE`, retry UI, **no fallback to demo** |
| Replay verification | Same `verifySolution()` path as live | same |
| Reconstruction invalid-state test | "Test Invalid Cube State" button retained, Demo only, produces a real `ApiErrorEnvelope`-shaped error from a fixture | real errors from API |
| Completion copy | "Demo guidance complete" | "Guidance complete — check your physical cube" |

Live readiness = `deriveLiveReadiness(health)` (pure, tested): `ready` only when `detectorMode==='yolo' && visionReady && solverReady`; `detectorMode==='fixture'` ⇒ `fixture-only` (visibly labelled, **never** enables unlabelled live capture); `visionReady:false` ⇒ `blocked(MODEL_UNAVAILABLE)` with solver still usable; unreachable ⇒ `blocked(BACKEND_UNAVAILABLE)`. Health, solve and camera requests each use a per-request guard (id + `AbortController`), so a stale or superseded response is ignored even within one session. Phase 1 has no scan transport, so capture remains blocked in every live state.

---

## 6. Regression tests

Runner: Vitest (`node` environment for engine/service tests, `jsdom` for component tests). Behavioural tests are written **before** the code they cover (RED, observed failing, then GREEN). Exempt from forced-RED: mechanical relocation (T1.1) and baseline characterization (T1.2), which must pass against *existing* behaviour on first run. Suites are separate so each can be run alone: `tests/engine`, `tests/services`, `tests/stores`, `tests/hooks`, `tests/components`, `tests/architecture`, `tests/demo`.

### 6.1 Characterization of the existing engine (T1.2, against the moved legacy `cubeEngine.ts`)
- 3 presets: scramble + solution returns to solved; each of 18 moves then inverse = identity on 3 scrambles; each face quarter-turn ×4 = identity (the 75 checks from the review, now committed).
- `extractFaceGrid` for every face on a fixed asymmetric scramble, and `parseMove` axis/layer/angle for all 18 tokens vs ARCHITECTURE §7.2.
- **Frozen goldens (B3):** the legacy outputs above are written once to `tests/golden/legacy-characterization.json` (literal arrays, with a header comment recording the generating commit). The *golden-based* assertions survive legacy deletion; only the differential tests that import `lib/cubeEngine.ts` are retired in T1.17. The goldens are not themselves treated as ground truth — §6.2 compares them with the independent reference.

### 6.2 Canonical engine (T1.3–T1.5)
- `parseFaceletState`: rejects length ≠ 54, characters ∉ `URFDLB`, count ≠ 9 per letter, centres not at indices 4,13,22,31,40,49; accepts `SOLVED`.
- `parseMoveToken` accepts exactly 18 tokens; rejects `x`,`y`,`z`,`M`,`Rw`,`r`,`R3`,`R2'`,`''`, empty, lowercase.
- **Independent reference (T1.4a/b).** `tests/reference/` contains a *cubie-level* move implementation whose permutation/orientation tables are **copied from a pinned upstream commit** (URL, commit SHA, licence, retrieval date in `tests/reference/PROVENANCE.md`) — **not typed from memory** and not derived from `engine/`. It is a mover, not a solver. Differential test: 500 seeded-random sequences (length 1–25, all 18 tokens, seed in the test) → after every move the facelet engine equals the reference's facelet string. Any mismatch **stops the task** and is resolved against the upstream source; neither side is adjusted to make the test pass.
- **Goldens not generated by the code under test:** scrambled fixture states come from the *reference* applied to a documented scramble; the fixture solution is the inverse of that scramble, accepted only after the reference itself replays it to solved. The hand-derived physical-definition vectors (e.g. `U` on solved cycles top rows F←R←B←L←F; `R U R' U'` ×6 = identity; `(R U)` has order 105) are a third, human-checkable layer. Cross-check against the Python `kociemba` package is a **Phase 2** gate, recorded as open.
- Properties on random sequences: centres fixed; 9 of each letter; `m ∘ inverse = id`; `m⁴ = id` (quarter), `m² ∘ m² = id` (half).
- `buildSnapshots`: length `moves+1`; `S[0]` = initial; `S[i+1] = applyMove(S[i], m[i])`. `verifySolution`: ok for correct; fails for tampered move, tampered initial state, non-solved ending; **empty moves ok iff state is solved** (empty on scrambled ⇒ fail).
- **`bindSolveResponse(request, response)` (B4):** (a) valid scrambled request + genuine response ⇒ ok; (b) **valid-but-wrong**: scrambled request with the *solved-cube* response (shape valid, replay-to-solved passes) ⇒ `RESPONSE_MISMATCH`; (c) `centerColors` that differ from those implied by the request (e.g. swapped U/D colours) ⇒ `RESPONSE_MISMATCH`; (d) `moveCount ≠ moves.length` ⇒ rejected; (e) correct state + wrong move list ⇒ `SOLUTION_REPLAY_MISMATCH`; (f) solved request + empty moves ⇒ ok; (g) scrambled request + empty moves ⇒ rejected.
- Renderer adapter: `toCubies(SOLVED, DEMO_CENTERS)` equals legacy `createSolvedCube()` stickers; `toCubies` after each of the 18 moves equals legacy cubie `applyMove` result (differential, retired in T1.17, goldens remain); custom centre mapping (e.g. U=blue, F=red…) maps colours correctly; missing sticker or centre ⇒ throws (no `'W'` fallback).
- `buildFaceletState(sixFaces)`: all six unique centres (`DUPLICATE_CENTER`), nine of each colour (`COLOR_COUNT_MISMATCH`), missing face ⇒ error (never filled); round-trips with `facesFromState`. This is a *structural* check only — physical legality is the backend's (Phase 2).

### 6.3 API/services (T1.6)
- Wire parsers: valid fixtures pass; wrong `schemaVersion`, `moveCount ≠ moves.length`, illegal token, bad `initialState`, duplicate/unknown colours, **extra keys (e.g. `source`)**, missing keys ⇒ `BAD_RESPONSE`. A test asserts that the demo path never mutates the wire object: `SolveOutcome.source` is outside `response` and `parseSolveResponse(outcome.response)` succeeds (B5).
- Error typing: server `ApiErrorCode` accepted only from a parsed envelope; client codes (`NETWORK`, `BACKEND_UNAVAILABLE`, `BAD_RESPONSE`, `RESPONSE_MISMATCH`, `SOLUTION_REPLAY_MISMATCH`, `REQUEST_CANCELLED`, `REQUEST_INVALID`) never appear in wire types; exhaustive `switch` compile test.
- `solver-client` (mock `fetch`): 200 ok; 422 envelope ⇒ `{kind:'api'}` with `retryable`; 503/network ⇒ `BACKEND_UNAVAILABLE`; abort ⇒ `REQUEST_CANCELLED` and **no** result delivered; malformed JSON ⇒ `BAD_RESPONSE`. Fixtures in `/fixtures/solve/*.json` are the same files the backend will load.
- `health-client` + `deriveLiveReadiness`: `ok+yolo+visionReady+solverReady` ⇒ `ready`; `detectorMode:'fixture'` (even all-true) ⇒ `fixture-only` (labelled, never `ready`); `visionReady:false` ⇒ `blocked(MODEL_UNAVAILABLE)` with solver still reported usable; unreachable ⇒ `blocked(BACKEND_UNAVAILABLE)`.
- `contain-transform`: letterbox maths (`scale = min(vw/fw, vh/fh)` plus offsets), frame↔view round trip, non-square, unmirrored.

### 6.4 Playback (T1.9–T1.10)
Reducer (all against the spec in §2.1):
- **B1:** RESET gen1→gen2 re-initializes everything (including a half-finished gen1 state); *late* gen1 TICK/PAUSE/REPLAY after gen2 are reference-equal no-ops; *late* RESET gen1 (and duplicate RESET gen2) after gen2 is a no-op; RESET on `idle`; RESET empty ⇒ `complete`, `total 0`, `displayedSnapshotIndex === 0`, START no-op; `displayedSnapshotIndex === 0` before START and for `total=0`; never `index+1` outside `[0,total]`.
- **B2:** `R` animation = 780 ms exactly, `F2` = 975 ms; pause mid-`F2` preserves its elapsed; `animationProgress` uses the per-move duration; replay of `F2` is 975 ms; final wait completes; `TICK 2000` ≡ twenty `TICK 100` (associativity over many random splits); overshoot carries into the next phase (e.g. tick spanning end-of-anim + 300 ms of wait gives `waitElapsed=300`); overshoot at the very end is discarded and not counted in `playbackMs`; NaN/negative/∞ `dtMs` ignored.
- Pause/resume in both phases; replay derived-state sequence never shows `index+2` and never changes `index`; `SET_DELAY` mid-wait leaves `waitTotalMs` unchanged but the next wait uses the new value; **no `SKIP_WAIT` event exists** (compile-time exhaustiveness test).
- Seeded property test (invariants, §2.1 item 10) over `total ∈ {0,1,2,5,18}`.

`usePlayback` (fake timers + stubbed `requestAnimationFrame`/`performance.now`):
- Constant 16 ms frames reach `complete` at ≈ `Σ(animMs)+total·delayMs` (exact to one frame); visible stall of 5 s is **truncated to 250 ms** (documented policy), so `playbackMs` < wall time and steps do not skip; `hidden` ⇒ `PAUSE{hidden}` and no step advances while hidden; `lastTs` reset on resume (first dt after resume ≤ one frame); unmount cancels the frame loop; new `generation` (rescan) ⇒ old frame callbacks are no-ops; React StrictMode double-mount yields exactly one loop; the renderer progress ref and the displayed index come from the same state (no second clock).

### 6.5 Stores, request guard and orchestration (T1.8, T1.15)
- `createLatestGuard()`: `begin()` aborts the previous request; `isCurrent()` is false for superseded and for post-`reset()` requests; **stale success and stale error after a newer request are ignored** (two overlapping solve retries in one session, and the same for health).
- `startSession` increments `sessionId`, aborts guards, clears scan/cube slices; a late solve resolution after `startSession` is discarded.
- `captureFace(face, grid, source)` stores the **given** grid, never a fixture; `buildSolveRequest` refuses incomplete captures.
- `useSolveSession`: success ⇒ binds (`bindSolveResponse`) then `ready`; valid-but-wrong response ⇒ `error: RESPONSE_MISMATCH`, playback never enabled; wrong solution ⇒ `SOLUTION_REPLAY_MISMATCH`; empty solution on solved ⇒ `ready` with `moves=[]`; cancelled ⇒ no state change; retry produces a new request id and a late response from the first is ignored.
- Compat facade (T1.8): demo flow Landing→…→Completion works through the facade backed only by the new stores (one source of truth, asserted by writing via the new store and reading via the facade, and vice versa is **not** allowed).

### 6.6 Components (T1.12–T1.16; jsdom + RTL, `RubiksCube3D` mocked)
- **Solving:** empty solution ⇒ no NaN/undefined, "Already solved" state, no countdown; Pause freezes ring and the (mock) renderer progress; Resume continues; Replay keeps "Step N of M"; slider change mid-countdown does not change the current ring; hidden tab pauses; **no Previous/Next controls rendered**; Pause/Resume, Replay, Pace, camera lock, sound, "Scan again" present; orientation cue (Top/Front/Right colours from `centerColors`, plus current target centre + face name + direction) is always present and uses *non-demo* centres in the test; Completion shows `playbackMs` as "Guidance time" (no padding).
- **Completion:** no confetti before confirm; copy differs pre/post confirm and per mode; renders the session's final snapshot (props to mocked cube), not a hard-coded one.
- **Scanner:** live + no backend ⇒ `LiveUnavailablePanel`, capture disabled, no overlay boxes, no "confidence"; `fixture-only` readiness ⇒ labelled banner, capture still disabled in Phase 1; demo ⇒ banner; `<video>` has no mirror transform; camera lifecycle (B7): `stop()` on every acquired track on unmount, on leaving, on permission failure (rejection carries no tracks), **late `getUserMedia` resolution after teardown stops its tracks immediately and attaches nothing**, a restart during a pending acquisition keeps only the newest stream, StrictMode double-mount leaves exactly one live stream.
- **Reconstruction:** missing face ⇒ error, never filled; API/client errors shown with retryability; demo-only invalid-state button; stale retry result ignored.
- **Alignment:** labels from `centerColors` (non-demo test centres); 0 moves ⇒ "Already solved" path with Finish.
- **Mode banner** present on every screen in demo, absent in live.
- **Architecture guard** (`tests/architecture`): `engine/`, `demo/`, `types/`, `services/` import none of `react`, `three`, `zustand`, `@/components`, `@/features`, `@/hooks`, `@/stores`, or DOM globals (`window`, `document`, `navigator`); a second assertion fails if `lib/cubeEngine` or `store/useRubikStore` is imported anywhere after T1.17.

### 6.7 Manual / browser regression (Phase 0 baseline vs Phase 1 final; 1440×900 and 390×844)
Reported honestly: if no supported browser is available, the affected checks are listed as **NOT RUN** with the reason; no inference from jsdom/code review is substituted.

Screens: Landing; Scanning (simulated normal + each condition); Reconstruction (2D net, 3D twin, invalid); Alignment; Solving (mid-animation, countdown, paused); Completion (before/after confirm). Equivalence is judged on layout, colour, typography, cube look, animation feel; intentional differences are enumerated (demo banner, removed numeric confidences, removed mirrored webcam, removed Prev/Next).

**Asymmetric direction check (needed because camera-off guidance depends on it).** Use demo scramble #0 (solution tokens in playback order: `D' F U' R2 B D2 L U' F' R U2 B2 L' D F2 R U' R'` — contains all six faces, primes and doubles; T0.4 re-derives this list from the running app and the check is run on what is actually displayed). Slow the pace to 2 s and use Free Orbit. For every move type seen (R, U, F, B, D, L; one prime and one double each where available) confirm visually, viewing the named face from outside:

| Move | Expected motion of the stickers of the layer (clockwise = viewed from outside that face) |
|---|---|
| R | front-face column of that layer moves **up** (F→U) |
| U | front-top row moves **left** (F→L) |
| F | top row moves **right** (U→R) |
| D | front-bottom row moves **right** (F→R) |
| L | front column moves **down** (F→D) |
| B | top row moves **left from the front view** (U→L, i.e. clockwise seen from behind) |
| X' | opposite direction; X2 = 180° |

Also check at least once: pause **during** a rotation freezes the layer, resume continues without a jump; replay re-shows the same move; the orientation cue stays visible while orbiting to the back/bottom; after the last move the displayed cube is the solved cube. A solved final cube alone is not accepted as evidence of correct direction.

---

## 7. Implementation tasks

Conventions (all tasks):
- Package manager is **npm** (D2-B). After T0.2, installs are `npm ci`. Commands are run from the repo root until T1.1, from `frontend/` afterwards.
- `RED` = write the test, run it, **observe the failure and record its message**; `GREEN` = minimal implementation, run, record counts. Mechanical relocation (T1.1) and baseline characterization (T1.2) are exempt from forced-RED.
- Every task ends with a record in the running report (`docs/superpowers/reports/phase1-verification.md`, started in T1.2): command, exit status, passed/failed counts, anything not run. Never write "passes" without the output.
- Every commit must typecheck and build (before T1.2: same result as the recorded baseline; from T1.2: strict). One commit per task, `type(scope): summary`, ending with the attribution trailer. Before each commit: `git status` and `git diff --cached --stat` are reviewed; no `.env*`, weights, captures, `node_modules`, `dist`.
- Stop conditions: install failure, baseline build failure, reference/engine disagreement, any failing gate. Stop and report; do not work around.

### Phase 0 — Baseline verification (executes only after plan approval)

**T0.1 Safe Git baseline and snapshot** — Deps: plan approval (D4-A).
- [ ] Inspect before touching anything: `ls -la`, current `.gitignore` (today: `node_modules/ build/ dist/ coverage/ .DS_Store *.log .env* !.env.example`), `find . -type f -size +1M` (expected: only `src/assets/images/…jpg`, ~710 KB, a stock-style demo image — confirm it is not a private capture before committing), list of `.env*` files (expected: only `.env.example` with placeholders), and a secret pattern scan over text files (`grep -rnEI "(api[_-]?key|secret|token|passwd|BEGIN [A-Z ]*PRIVATE KEY|AIza[0-9A-Za-z_-]{20,})"` excluding `bun.lock`), recording every hit and its disposition. Confirm `~/.claude`/`.claude/settings.local.json`/`.codegraph/` do not exist in the repo tree.
- [ ] Snapshot, non-destructive: compute `dst=../rubik-solver-yolo-baseline-<YYYYMMDD-HHMM>`; **abort if it already exists**; copy the tree excluding `node_modules` and `dist`; write a SHA-256 manifest of source files into the Phase 0 report. Never overwrite an existing backup.
- [ ] (Adapted per the user's Git workflow.) Verify the existing repo: current branch is `chore/phase-0-baseline`, the baseline commit exists on `main` and is preserved, the working tree is clean, no remote is configured. Do **not** run `git init`, and do not recreate or amend the baseline commit. Audit the baseline commit's tracked files and its `.gitignore` (the user's `.gitignore` already contains the hardening lines listed in the original T0.1; record any gaps instead of silently editing it).
- [ ] Phase 0 commits (lockfile, report) go on `chore/phase-0-baseline`, one meaningful commit each, after reviewing the staged diff.
- [ ] Verify: `git log --oneline --all`, `git status` clean, `git remote -v` empty, no tracked `.env`/`.pt` files.

**T0.2 Toolchain record, npm install, lockfile, baseline build** — Deps: T0.1.
- [ ] Record `node -v` (v26.9.0 seen), `npm -v` (11.19.1 seen), OS.
- [ ] `npm install` (fresh resolution — **baseline deviation from `bun.lock`**, recorded verbatim). If resolution fails: record exact error, stop, ask; no version edits.
- [ ] Record `npm ls --depth=0` (actual installed versions) in the report.
- [ ] `npm run lint` → record verbatim result (current non-strict `tsc --noEmit`). `npm run build` → record result, warnings, bundle sizes. Failures are baseline facts, not bugs to hide.
- [ ] Commit `build: add package-lock.json (npm, baseline deviation from bun.lock)`. `bun.lock` is kept until T1.1.

**T0.3 Dependency-usage evidence (read-only)** — Deps: T0.2.
- [ ] For every dependency and devDependency run a recorded `grep -rn` over `src/ index.html vite.config.ts` for import sites; record the table. Expected "unused": `@google/genai`, `dotenv`, `express`, `@types/express`, `motion`, `tsx`, `esbuild`, `autoprefixer`; expected phantom import: `three-stdlib` (`RubiksCube3D.tsx:6`). Also record whether `metadata.json`, `.env.example` keys, or `process.env`/`import.meta.env` are read anywhere.
- [ ] Output: table in the baseline report (feeds T1.18 and the metadata decision).

**T0.4 Browser availability check, smoke test, screenshots** — Deps: T0.2.
- [ ] Determine whether a supported browser is available to the session (Claude browser pane or Chrome extension). If **none**: record "browser checks NOT RUN: <reason>" and skip the rest of this task; the gate then requires your explicit decision on how to proceed.
- [ ] `npm run dev`; walk all six screens in the demo flow at 1440×900 and 390×844; exercise each simulated scan condition, invalid-state toggle, pause/resume/replay mid-rotation, slider, camera lock. Save PNGs to `docs/superpowers/reports/screenshots/baseline/` (no personal camera frames; the real-webcam toggle is not used with a person on camera).
- [ ] Record the actual demo-scramble solution token order shown on screen (used by §6.7), and reproduce/record defects F8–F11 where feasible.

**T0.5 Baseline report and gate** — Deps: T0.1–T0.4 (**including T0.3**).
- [ ] Write `docs/superpowers/reports/phase0-baseline.md`: Git audit results and housekeeping exception, snapshot path + manifest, node/npm versions, **actual installed versions**, lint/build verbatim, T0.3 table, screenshot index or "NOT RUN", reproduced defects, open risks, the D2 baseline deviation.
- [ ] Commit `docs: phase 0 baseline report`. **GATE: stop for your review.** A failing baseline build is not bypassed. After approval, and only on explicit instruction, `chore/phase-0-baseline` is merged into `main` and `refactor/phase-1-frontend` is branched from the result.

### Phase 1 — Frontend refactor (executes only after the Phase 0 gate is approved)

**T1.1 Relocate to `frontend/` (mechanical)** — Deps: Phase 0 gate.
- [ ] `git mv` per §3 (move only). Delete `bun.lock` (`git rm`), move `package-lock.json`. `@` → `./src` in Vite + tsconfig; rewrite `@/src/` → `@/` mechanically; webcam image becomes a module import. Keep the copy plugin and all other config for now.
- [ ] Verify (no forced RED): `cd frontend && npm ci`; `npm run lint` and `npm run build` give the **same** pass/fail as T0.2 (not worse); dev smoke of the six screens; screenshots vs baseline (or NOT RUN).
- [ ] Commit `refactor(frontend): relocate to frontend/ (no behaviour change)`.

**T1.2 Test tooling, strict mode, characterization** — Deps: T1.1.
- [ ] Add dev deps (D6) with versions chosen from actual peer ranges; `test`, `test:watch` scripts; `vitest.config.ts` sharing the `@` alias; separate suite dirs (§6).
- [ ] Enable `"strict": true`; remove `allowJs`, `experimentalDecorators`; fix resulting errors with behaviour-neutral edits, each listed in the report.
- [ ] Characterization tests (§6.1) against legacy engine + `tests/golden/legacy-characterization.json`; empty `tests/architecture` guard scaffold.
- [ ] Start `docs/superpowers/reports/phase1-verification.md`.
- [ ] Verify: `npm run test` (record counts), `npm run lint`, `npm run build`. Commit `test(engine): characterization suite and strict tsconfig`.

**T1.3 Canonical types, geometry, facelet state** — Deps: T1.2.
Files: `types/cube.ts`, `engine/facelet-geometry.ts` (single source of the §6.4 table, used by move engine and adapter), `engine/cube-state.ts`, `lib/colors.ts`; tests `tests/engine/cube-state.test.ts`.
- [ ] RED: `parseFaceletState` rejection/acceptance cases, `buildFaceletState` (duplicate centres, count mismatch, missing face), `facesFromState` round-trip (§6.2). Observe failure.
- [ ] GREEN: implement; geometry index↔(cubie,normal) is *computed* from `n,a,b`, not hand-typed per index.
- [ ] Verify `npm run test -- tests/engine/cube-state`; commit `feat(engine): canonical facelet state`.

**T1.4a Independent reference provenance** — Deps: T1.2. (Requires network access to fetch upstream; if unavailable, stop and ask.)
- [ ] Fetch the cubie-definition data from the pinned upstream source (hkociemba/RubiksCube-TwophaseSolver and/or muodov/kociemba facelet definitions) into `tests/reference/vendor/` by **commit SHA**, treating downloaded files as untrusted data (not executed; transcribe only the needed numeric tables).
- [ ] Write `tests/reference/PROVENANCE.md`: URL, SHA, licence (check compatibility with this repo — if the licence is restrictive, keep only factual numeric tables and flag it for your decision), date, who/what transcribed, checksum. Tables are never typed from memory.
- [ ] Implement the cubie-level mover `tests/reference/cubie-reference.ts` (mover only, no solver) and a self-test: documented identities (`move⁴=id`, order of `R U R' U'` is 6, `(R U)` order 105) hold **on the reference alone**.
- [ ] Commit `test(reference): pinned cubie reference with provenance`.

**T1.4b Move engine** — Deps: T1.3, T1.4a.
Files: `engine/move-engine.ts`, `engine/move-presentation.ts`; tests `tests/engine/move-engine.test.ts`.
- [ ] RED: 18-token parser, properties, `buildSnapshots`/`verifySolution` cases, hand-derived goldens, and the 500-sequence differential vs the reference. Observe failure.
- [ ] GREEN: `applyMove` via 54-index permutations computed at module load from the geometry + §7.2 rotation table (integer rotation); `parseMove` moved verbatim from legacy.
- [ ] Verify `npm run test -- tests/engine`; **stop on any disagreement**. Commit `feat(engine): move engine verified against pinned reference`.

**T1.4c Solve-response binding** — Deps: T1.4b.
Files: `engine/solve-binding.ts` (`bindSolveResponse`); tests per §6.2 (a)–(g).
- [ ] RED (incl. the valid-but-wrong solved-response case) → GREEN → commit `feat(engine): bind solve response to request`.

**T1.5 Renderer adapter and presentation metadata (additive — legacy kept)** — Deps: T1.4b.
- [ ] RED: adapter tests §6.2 (differential vs legacy + frozen goldens, custom centres, throws on missing).
- [ ] GREEN: `engine/cubie-adapter.ts`; `lib/colors.ts` takes over `STICKER_COLORS`; `features/scanner/scan-guide.ts` generates instructions from `(stage, knownCenters?)` (no colour word for an unobserved centre). **Nothing is deleted and no screen is re-pointed yet**; legacy `cubeEngine.ts` and `useRubikStore` remain the production path.
- [ ] Verify test + lint + build + unchanged screens. Commit `feat(engine): cubie adapter and presentation metadata`.

**T1.6 API types, parsers, request guard, clients, fixtures** — Deps: T1.4c.
Files: `types/api.ts` (wire types + client `SolveError`/`SolveOutcome`), `services/{parsers,health-client,solver-client,scan-transport,api-config}.ts`, `lib/request-guard.ts`, `/fixtures/{solve,health}/*.json`.
- [ ] RED: §6.3 tests (strict wire parsing incl. extra-key rejection, error typing, client behaviours, `deriveLiveReadiness`, guard behaviour from §6.5).
- [ ] GREEN. Fixture content: solved cube; one asymmetric scramble whose `initialState` is produced by the **reference** and whose `moves` are the inverse scramble replayed to solved by the reference; invalid-state envelopes per ARCHITECTURE §8.3.
- [ ] `scan-transport.ts` exports the interface and `UnavailableScanTransport` only (no WebSocket code in Phase 1).
- [ ] Verify `npm run test -- tests/services`; commit `feat(services): typed validated API clients and request guard`.

**T1.7 Demo module** — Deps: T1.4c, T1.6.
Files: `demo/demo-fixtures.ts` (scrambles **copied** — not moved — from legacy as `MoveToken[]`, `DEMO_CENTER_COLORS`), `demo/demo-solver.ts` (returns a `SolveOutcome{response, source:'demo-fixture'}` where `response` is a strict-schema `SolveResponse`), `demo/demo-scan-source.ts`.
- [ ] RED: every demo outcome passes `parseSolveResponse` **and** `bindSolveResponse` against the request built from the demo faces; provenance only on the wrapper; demo module imports nothing from UI/stores.
- [ ] GREEN → commit `feat(demo): explicit demo fixtures with provenance wrapper`.

**T1.8 Stores, session lifecycle, compat facade** — Deps: T1.5, T1.6, T1.7.
Files: `stores/{session-store,scan-store,cube-store}.ts` (settings — delay, sound — live in `session-store`), `hooks/{useSolveSession,useBackendHealth}.ts`, temporary `store/useRubikStore.ts` rewritten as a **read-through facade** over the new stores (same field/action names so unmigrated screens compile and behave; legacy cube data derived through `toCubies`). No state is duplicated.
- [ ] RED: §6.5 store/guard/facade tests.
- [ ] GREEN: `startSession(mode)` is the only place that bumps `sessionId`, aborts guards and resets slices; every async consumer captures its guard handle.
- [ ] Verify tests + lint + build + **demo flow smoke through the facade** (all six screens still work). Commit `feat(stores): session lifecycle with request guards (legacy facade)`.

**T1.9 Playback FSM (pure)** — Deps: T1.4b. *(parallel to T1.5–T1.8)*
File `engine/playback-fsm.ts`; tests `tests/engine/playback-fsm.test.ts`.
- [ ] RED: every item in §2.1 spec and §6.4 reducer list (B1, B2, associativity, invariants). Observe failure.
- [ ] GREEN → verify `npm run test -- playback-fsm`; commit `feat(engine): playback state machine`.

**T1.10 `usePlayback` hook** — Deps: T1.9, T1.8.
- [ ] RED: §6.4 hook tests (stall truncation 250 ms, hidden pause, `lastTs` reset, StrictMode, generation).
- [ ] GREEN: single rAF loop; exposes `{state, displayedSnapshotIndex, progressRef, controls}`; UI state published ≤ 30 Hz, renderer reads `progressRef` per frame; audio cues emitted from reducer transitions (move start, last-3-seconds ticks, success), not from step-keyed effects.
- [ ] Verify + commit `feat(hooks): usePlayback with single clock`.

**T1.11 `RubiksCube3D` controlled animation + type fix** — Deps: T1.10, T1.5.
- [ ] RED: unit tests for pure `components/three/animation.ts` (`easeInOutCubic`, `pivotRotation(move, progress)`; same curve as today).
- [ ] GREEN: renderer takes `moveProgress` (ref or number) and `activeMove`; internal elapsed/duration/`onMoveAnimationComplete` path removed (single owner); pivot reset to identity when progress is `null` or `cubies` change; `three-stdlib` type import replaced by `React.ElementRef<typeof OrbitControls>`; materials, lighting, arrow, `isSoftwareGl`, context-loss recovery untouched. Landing/Reconstruction/Alignment/Completion/Scanner usages (no animation) keep working.
- [ ] Verify unit + lint + build; manual (or NOT RUN): Pause mid-turn freezes the layer, Resume continues without a jump; screenshots vs baseline. Commit `refactor(three): controlled move progress`.

**T1.12 Solving screen** — Deps: T1.10, T1.11, T1.8.
- [ ] RED: §6.6 Solving tests (no Prev/Next, empty-solution, pause/replay, orientation cue, Guidance time).
- [ ] GREEN: split into `MoveInfoPanel`, `CountdownRing`, `PlaybackDock` with JSX/classes copied verbatim; displayed cube = `toCubies(snapshots[displayedSnapshotIndex], centers)`; **Prev/Next removed** (D3-B); Lost-track dialog: "Replay current move" (`REPLAY`) and "Scan my cube again" (`startSession`); progress bar `(index+animFraction)/total` guarded for `total=0`; header "Step N of M" hidden when `total=0`; **persistent orientation cue**: a compact always-visible chip group *Top / Front / Right* centre colours (from `centerColors`), plus in the move panel the target centre colour, face name and direction wording (already present — now derived, not hard-coded), and the lock tooltip uses live colours. Entering Solving remains one deliberate Start click from Alignment.
- [ ] Verify tests + manual §6.7 direction table (or NOT RUN). Commit `refactor(solver): playback-driven solving screen`.

**T1.13 Alignment and Completion truthfulness** — Deps: T1.12.
- [ ] RED: §6.6 Alignment/Completion tests.
- [ ] GREEN: Alignment labels from `centerColors`; `0 moves ⇒` "Your cube is already solved" with Finish; Start enabled only when cube-store is `ready`. Completion: final snapshot cube, **"Guidance time"** from `playbackMs` (no `Math.max` padding), no auto-confetti, confetti only after the confirm click (still honouring `prefers-reduced-motion`), "54 stickers" claim only after confirmation, per-mode copy.
- [ ] Verify + commit `refactor(solver): truthful alignment and completion`.

**T1.14 Scanner: demo/live split and camera lifecycle** — Deps: T1.6, T1.8, T1.5.
- [ ] RED: §6.6 Scanner tests incl. camera race tests with deferred `getUserMedia` promises and StrictMode.
- [ ] GREEN: `hooks/useCamera.ts` (per-acquisition guard; stops tracks of any stale/late stream immediately; classifies `NotAllowedError`/`NotFoundError`; never mirrors); `lib/contain-transform.ts`; split `ScanningScreen` into `ScanViewport`, `ScanGuidePanel`, `CapturedFacesPanel`, `ScanSettingsDialog`, `LiveUnavailablePanel` (JSX copied verbatim). Demo: scripted source, no numeric confidences, no real-webcam toggle, labelled "Simulated feed". Live: real preview only, no overlay, readiness via `deriveLiveReadiness` (`fixture-only` visibly labelled), capture disabled in Phase 1. Face-rescan rule: if orientation context is lost, prompt a full restart (ARCHITECTURE §4.3).
- [ ] Verify tests; manual: demo scan completes; live shows "unavailable"; camera indicator off after leaving (or NOT RUN). Commit `refactor(scanner): demo/live split, camera lifecycle`.

**T1.15 Reconstruction on real data** — Deps: T1.8, T1.6, T1.7, T1.4c.
- [ ] RED: §6.6 Reconstruction + §6.5 `useSolveSession` binding/stale tests.
- [ ] GREEN: demo → `demo-solver`; live → `solver-client` via `useSolveSession` (guard + abort; **binding verified before `ready`**). Checklist items are real stages (faces complete → colour counts → unique centres → solve request → binding → replay → ready) with real pass/fail; the staggered reveal is presentation only. Summary numbers derive from data. Invalid-state button demo-only, yields an `INVALID_CUBE_STATE` envelope. No merging of `targetFaces`.
- [ ] Verify + commit `refactor(review): reconstruction driven by validated solve outcome`.

**T1.16 Landing and mode banner** — Deps: T1.8, T1.14.
- [ ] RED: banner present in demo on every screen, absent in live; D1 behaviours (shortcut → Reconstruction demo; "Walk through the simulated scan" → Scanning demo).
- [ ] GREEN: `ModeBanner`; hero cube via `toCubies`; Kociemba claim in demo CTA subtext qualified ("Demo uses a pre-computed solution"). Commit `feat(landing): explicit demo/live entry`.

**T1.17 Legacy cutover removal** — Deps: T1.12–T1.16 all merged.
- [ ] Gate checks (must all be clean before deleting): `grep -rn "lib/cubeEngine\|store/useRubikStore\|useRubikStore" src` shows only the files to delete; `npm run lint`; `npm run test`.
- [ ] Remove the facade `store/useRubikStore.ts`, legacy `lib/cubeEngine.ts`, and the differential tests that import it; keep `tests/golden/legacy-characterization.json` assertions (now compared to the reference-derived engine). Architecture guard test now asserts no imports of the removed paths.
- [ ] Verify lint/test/build/grep (expected: zero matches) and screenshots. Commit `refactor: remove legacy engine and store`.

**T1.18 Scaffold cleanup** — Deps: T1.17, T0.3.
- [ ] `package.json`: name `rubikvision-frontend`; remove only dependencies with T0.3 evidence "no import"; no version bumps; portable `clean`; `dev` → `vite --host 127.0.0.1 --port 5173`; keep `test`. `package-lock.json` regenerated minimally; summarize removed packages.
- [ ] `vite.config.ts`: drop AI-Studio HMR/watch toggles; add proxy (`/api`,`/health` → `http://127.0.0.1:8000`; `/ws` with `ws:true`); remove `copy-unbundled-src-assets` **after** confirming `dist/assets/*.jpg` is emitted and referenced by the built JS/CSS.
- [ ] `.env.example` → only used `VITE_*` keys (none required); `README.md` real run/test/build instructions (npm), Demo vs Live, privacy note; `.gitignore` additions already in T0.1; `metadata.json` → `docs/legacy/ai-studio-metadata.json` iff T0.3 shows no runtime use.
- [ ] Verify: `npm ci`, `npm run lint`, `npm run test`, `npm run build`, dev server reachable at `127.0.0.1:5173` and **not** on `0.0.0.0` (`netstat -ano | findstr 5173`). Commit `chore(frontend): remove AI Studio scaffolding`.

**T1.19 Final verification and report** — Deps: T1.18.
- [ ] Fresh full run, outputs captured verbatim: `npm ci`, `npm run lint`, `npm run test`, `npm run build`; static greps (§9).
- [ ] Browser regression §6.7 at both viewports incl. the direction table, or **NOT RUN** with reason.
- [ ] Full demo solve end-to-end; Live without backend is blocked; camera cleanup; hidden-tab pause.
- [ ] Write `docs/superpowers/reports/phase1-verification.md`: package manager and **actual installed versions** (`npm ls --depth=0`), every command with exit status and counts, screenshot index or NOT RUN, deviations from this plan, remaining risks. Commit `docs: phase 1 verification report`. **GATE: stop for your review.**

**T1.20 Architecture amendments (docs only)** — Deps: your approval of §11; may run any time after T1.4c.
- [ ] Apply §11 to `docs/ARCHITECTURE.md` as v1.1 with a changelog; touch no other doc. Commit `docs(architecture): v1.1 model-last amendments`. CLAUDE.md is updated only if the commands in it changed, and shown to you first.

**Stop.** Phase 2 (backend) gets its own design and plan.

### Dependency graph (revised)
```
approval → T0.1 → T0.2 → T0.3 ─┐
                    └──→ T0.4 ──┴→ T0.5 [GATE] → T1.1 → T1.2 ─┬→ T1.3 ─┐
                                                              └→ T1.4a ┴→ T1.4b → T1.4c ─┬→ T1.5 ─┐
                                                                                         ├→ T1.6 ─┴→ T1.7 → T1.8 ─┐
                                                                         T1.4b → T1.9 ───────────────────────────────┴→ T1.10 → T1.11 → T1.12 → T1.13 ─┐
                                                                                                  T1.8 → T1.14 → T1.15 → T1.16 ───────────────────────┴→ T1.17 → T1.18 → T1.19 [GATE]
T1.20 ← approval of §11 (after T1.4c)
```
Parallelizable: T1.9 with T1.5–T1.8; T1.14–T1.16 with T1.10–T1.13 once T1.8 has landed. No task deletes legacy code before T1.17.

---

## 8. P0 coverage matrix (handoff → plan)

| Handoff P0 | Where fixed | Proof |
|---|---|---|
| Simulated scanning / fake confidence | T1.14, §5 | Scanner tests: live has no overlay/confidence; demo labelled, no numeric confidence |
| Hard-coded orientation | T1.3, T1.5, T1.13, T1.14 | Non-demo `centerColors` tests (Alignment, Solving tooltip, adapter) |
| Canonical state compatibility | T1.3–1.6 | Differential vs independent reference; `fixtures/` shared with future backend |
| Animation pause/resume | T1.9–T1.12 | Reducer + hook + manual mid-turn pause |
| Playback timer reliability | T1.10 | Monotonic clock, 250 ms dt cap, hidden-tab test, `playbackMs` ("Guidance time") |
| Replay without double apply | T1.9, T1.12 | Derived state test (`displayedSnapshotIndex`) |
| Empty solution handling | T1.9, T1.12, T1.13, T1.8 | Tests + "Already solved" path |
| Stale callbacks after rescan | T1.6, T1.8, T1.9, T1.10, T1.14, T1.15 | generation guard in reducer (B1) + per-request guards (B7) + stale-success/stale-error tests |
| Accurate completion status | T1.13 | No padding, no auto-confetti, honest copy |

Handoff P1 items also covered: the **persistent orientation cue** (Top/Front/Right centre colours plus target centre and direction) is implemented in T1.12 as ARCHITECTURE §7.2 requires; only the *dynamic camera-reposition* redesign (`autoRepositionCamera`, back/bottom viewpoint UX) is deferred to Phase 4 to avoid altering the UI. Confetti/time (P1) → T1.13. Package cleanup (P1) → T1.18.

---

## 9. Verification commands (T0.2 baseline; T1.19 final; per-task subsets in §7)

Package manager: **npm**. Commands run from `frontend/` after T1.1 (repo root before). Results are copied into the reports with exit status and counts; a command that was not run is written as **NOT RUN**.

```bash
npm ci                                   # after package-lock.json exists (T0.2: `npm install` first run, deviation recorded)
npm ls --depth=0                         # actual installed versions, pasted into the report
npm run lint                             # tsc --noEmit (strict from T1.2)
npm run test                             # vitest run — all suites
npm run test -- tests/engine             # one suite;  npx vitest run tests/engine/move-engine.test.ts  = one file
npm run build                            # vite build — must emit a hashed webcam asset
npm run dev                              # manual browser regression §6.7 (127.0.0.1:5173)
# static evidence
grep -rnE "from '(@google/genai|dotenv|express|motion)'" src         # expect: no matches
grep -rn "@/src/" src                                                # expect: no matches
grep -rnE "lib/cubeEngine|useRubikStore" src                         # expect: no matches after T1.17
grep -rnE "targetFaces|STICKER_CONFIDENCES|generateScrambleSession" src   # expect: only under demo/ (if at all)
git status --short && git ls-files | grep -E "(^|/)\.env$|\.pt$|\.onnx$"  # expect: clean / no matches
```

---

## 10. Acceptance criteria (Phase 0 + 1 complete when all hold)

1. **Git/baseline:** baseline commit audited (secrets, ignored files, large/binary artefacts) with the housekeeping exception documented; snapshot made without overwriting; Phase 0 work on `chore/phase-0-baseline` and Phase 1 work on `refactor/phase-1-frontend` (created only after Phase 0 approval); merges into `main` only with user approval; no `.env`, weights or captures tracked.
2. `phase0-baseline.md` contains real command output, actual installed versions, the D2 npm deviation, the T0.3 table, and screenshots **or** an explicit NOT RUN.
3. `frontend/` type-checks under `strict`, `npm run test` is green with counts reported, `npm run build` succeeds; every commit on the branch built.
4. **Engine:** 18 moves match the *independent, provenance-pinned* reference on ≥ 500 seeded sequences plus the hand-derived vectors; goldens were not generated by the code under test; `bindSolveResponse` rejects a valid-but-wrong response (test present); every demo outcome passes strict wire parsing, binding and replay-to-solved before playback.
5. **Demo vs live:** no fabricated detections, confidences or grids outside a labelled demo; live without backend shows "unavailable" and cannot capture; `fixture-only` readiness is labelled and never enables unlabelled capture; preview is unmirrored with contain-fit; wire `SolveResponse` carries no provenance field.
6. **Orientation:** no hard-coded R/B/L/D centre colours outside `demo/` and the documented F=green/U=white start convention; the persistent Top/Front/Right cue plus target-centre/direction guidance is always visible while solving and derives from `centerColors` (tested with non-demo centres).
7. **Playback:** RESET/generation rules (B1) and per-move durations/overshoot rules (B2) tested; pause/resume suspends animation and countdown; replay never applies a move twice; hidden tab pauses with no step advance; final delay completes; delay changes apply next step; Prev/Next and `SKIP_WAIT` do not exist.
8. **Async races:** stale solve/health/camera results ignored (B7); late `getUserMedia` resolution stops its tracks; StrictMode leaves one stream/one rAF loop.
9. **Empty solution:** no NaN/undefined; `snapshots[displayedSnapshotIndex]` defined in every reachable state; Alignment offers Finish; Solving cannot be entered with nothing to play.
10. **Completion:** "Guidance time" = accumulated playback time (documented as not wall-clock); no auto-celebration; no physical-verification claim before user confirmation.
11. **Visual regression:** six screens at 1440×900 and 390×844 equivalent to baseline except the enumerated intentional differences — or reported NOT RUN with the reason; the §6.7 direction table was executed on the running app (or NOT RUN).
12. **Scaffold:** unused AI-Studio items removed only with T0.3 evidence; no version bumps; dev server loopback-only with proxy; legacy engine/store removed only in T1.17 after grep-clean; no empty directories or unused modules added.
13. `fixtures/` holds the shared solve/health JSON used by frontend tests and ready for backend tests.
14. Nothing from Phase 2+ (backend, weights, training) was started; the reports state limitations plainly.

---

## 11. Proposed ARCHITECTURE.md updates (v1.0 → v1.1, model-last)

(From handoff §2 plus this review cycle. Applied in T1.20 only after you approve; changelog at the top of the doc.)

1. **§13 replaced** — stage order: 0 Baseline → 1 Frontend refactor (demo explicit) → 2 Deterministic backend (health, Pydantic, reconstruction, Kociemba; no weights) → 3 Vision service with `FixtureDetector`, WebSocket v1, geometry → 4 Full integration without trained weights (**"software ready"** gate; `YoloDetector` adapter with test double) → 5 Dataset audit and training (deferred) → 6 Drop in `backend/weights/best.pt`, set `RUBIK_DETECTOR_MODE=yolo`, restart, real validation (**"model ready"** gate).
2. **§3, §5.4, §8.1, §11** — `RUBIK_DETECTOR_MODE=fixture|yolo` (default `yolo`). Backend starts without weights; `/health` reports process/solver independently of vision. `yolo` with missing/invalid weights ⇒ `MODEL_UNAVAILABLE`, scan blocked, solver usable. Fixture mode is opt-in, visible in `/health` and the UI, never treats arbitrary webcam pixels as detections, never a fallback from `yolo`; **fixture readiness is distinct from real readiness and never enables unlabelled live capture.** No silent COCO weights.
3. **§8.1 health** — additive fields `schemaVersion`, `status`, `detectorMode`, `visionReady`, `solverReady`, `modelVersion`, `device`, optional safe `error`; WS and REST remain v1.
4. **§5.1** — six labels; normalise by class **name**, verify all six + detection task, reject extra/missing/unknown labels; weights not committed; trusted local `best.pt` loaded once; restart on replacement.
5. **§5.2/§5.3** — ColorRubik2 priority audit candidate, Pavitras backup; 50 vs 60 epochs is a tunable baseline; collect a small independent real-image set early, train late.
6. **§6** — keep scan order `F R B L U D`, state order `URFDLB`; known centres come from the scan, only F=green/U=white is the start convention; nine boxes cannot prove face roll or hidden-neighbour identity; verify return-to-F before U and the 180° U→D tilt; UI copy must not name colours of unobserved centres.
7. **§8.2** — define ROI exactly (normalised `roi` in hello, applied server-side to the decoded unmirrored frame); shared contain transform for overlays; ROI change resets scan/handshake; one in-flight frame per connection, drained on stage change/rescan.
8. **§7 / §8.3** — `FaceletState` is the single source of truth; `CubieState[]` is a derived renderer adapter; strict runtime parsing; **solve response must be bound to the submitted request** (recomputed `initialState` and `centerColors` equal the response's, `moveCount === moves.length`) before replay-to-solved; client-only error codes are not part of the wire contract; precomputed snapshots; empty solution valid only for a solved state and skips playback.
9. **§7.3** — playback: per-move animation durations (quarter 0.78 s, half 1.25× that); delay measured after animation; speed change applies next step; pause suspends both phases; replay cannot re-apply a move; final delay not skippable; **no skip/previous controls** (physical progress cannot be inferred); RESET is generation-privileged and stale events are ignored; displayed metric is "Guidance time" (simulated playback clock), not solve time; a persistent U/F/R orientation cue is required while solving.
10. **§10 tree** — actual layout: `docs/ARCHITECTURE.md`, `frontend/src/{types,engine,demo,services,stores,hooks,features,components,lib}`, `frontend/tests`, repo-root `fixtures/`, `backend/app/vision/{fixture_detector,yolo_detector}.py`, `docs/superpowers/{specs,plans,reports}`; `features/cube/` intentionally absent.
11. **§12 / P0 release criteria** — split into *software-ready* and *model-ready*; fixtures/demo never establish detector accuracy.
12. **New §: Demo vs Live** — fabricated data may only appear under a persistent Demo label.
13. **New §: Independent engine verification** — reference tables pinned to an upstream commit with provenance; goldens not produced by the implementation under test; Python `kociemba` cross-check is a Phase 2 gate.
14. **§11 privacy note** — Google Fonts is a third-party runtime request; track "self-host fonts" as follow-up.

---

## 12. Risks and open technical concerns

| Risk | Mitigation / status |
|---|---|
| **npm resolves fresh versions** (no `bun.lock` reproducibility); bleeding-edge majors (TS 7, Vite 8, plugin-react 6, three 0.187) may not install, or may break Vitest | T0.2 installs and records first; test-runner versions chosen from peer ranges in T1.2; stop and ask before any bump or pin change. *Open until T0.2 runs.* |
| Reference tables require **network access** and a **licence compatible** with this repo | T1.4a stops if the fetch fails; if the licence is restrictive only factual numeric tables are kept and you decide. *Open.* |
| Reference and engine could share a conceptual error (both defined from the same published facelet convention) | Third layer of hand-derived physical vectors; manual direction table on the running 3D cube; Python `kociemba` cross-check in Phase 2. Not fully closed in Phase 1. |
| Compat facade (T1.8) is temporary scaffolding and a possible drift source | Facade reads only the new stores; removal gated in T1.17 by grep; flow smoke after T1.8 and each screen migration. |
| Enabling `strict` surfaces many type errors | Own task (T1.2); behaviour-neutral fixes only; listed in report. |
| Controlled-progress change could alter animation feel | Same easing/durations; pure helper unit-tested; manual comparison vs baseline or NOT RUN. |
| `playbackMs` is a simulated clock (250 ms per-frame cap); a long visible stall truncates it | Named "Guidance time", documented; not presented as solve time. |
| jsdom cannot test WebGL; browser may be unavailable | Three tree mocked, maths isolated in pure helpers; manual WebGL checks reported as run or NOT RUN. |
| Live path cannot be exercised without a backend | Phase 1 proves blocked behaviour and typed clients against mocks only; no claim of working live scanning. |
| `fixture-only` readiness handling is specified before the backend exists | Pure function + tests against fixtures; UI only labels/blocks; revisit in Phase 3. |
| UI regressions during file splits | JSX moved verbatim; screenshots at both viewports after each UI task. |
| Scope creep (dynamic viewpoint redesign, Playwright, self-hosted fonts) | Explicitly deferred. |

---

## 13. Execution protocol after approval
Use the Superpowers executing-plans (or subagent-driven-development) flow task by task with the checkbox steps in §7 (RED observed → GREEN → verify → commit). Stop only at the two gates (T0.5 and T1.19) or on a stop condition (install failure, baseline build failure, reference/engine disagreement, failing gate, unavailable network for T1.4a). Commits are authorized only as described in T0.1 and §7 conventions, one per task, after reviewing the staged diff. No dependency changes beyond D6 (adds) and T1.18 (evidence-based removals). Reports record only commands that were actually run; anything else is NOT RUN.

---

## 14. Approved execution constraints (user, 2026-11-19 — binding for Phase 0/1)

- **A. Renderer buildability:** T1.11 must not leave `SolvingScreen` broken. Either keep a narrowly scoped temporary compatibility path for the old `animateMoveTrigger`/`onMoveAnimationComplete` API until T1.12 lands (removed in T1.12), or perform T1.11+T1.12 as one atomic cutover commit. Tests must show the displayed snapshot, active move and animation progress stay synchronized across every phase transition; a solved final state alone is not evidence.
- **B. Playback generation:** distinguish the *session/scan* generation (`sessionId`) from the *playback-run* generation passed to RESET. Restarting playback of the same solution bumps only the playback-run generation, never resets captured cube data, and still rejects stale events (tests for restart/replay-from-completion + stale events after reset).
- **C. Baseline browser safety:** Phase 0 dev servers are started with a host override (`npx vite --host 127.0.0.1`) without editing baseline config, and they are terminated after verification.
- **D. Secrets/backups:** audit before staging/snapshots; reports and agent messages contain only redacted findings; backups live outside the repo and are never overwritten.
- **E. Reference:** pinned upstream with provenance and verified licence; no tables from memory; stop on licence/network blockers; never weaken reference assertions.
- **F. Dependencies:** npm only; document fresh resolution vs `bun.lock`; no silent up/downgrades, no `--force`/`--legacy-peer-deps`; stop on incompatibility.
- **G. Browser verification:** jsdom ≠ WebGL; unavailable browser checks are NOT RUN, never PASS.
- **H. Docs:** T1.20 runs before the Phase 1 gate; `CLAUDE.md`, README, architecture and real commands stay consistent; remove stale terms (e.g. `activeMs` → `playbackMs`).
- **Process:** Superpowers skills are **not installed** in this environment (verified Phase 0); the equivalent protocol is followed manually: Sonnet implementer → separate Sonnet spec-compliance reviewer → separate Sonnet code-quality reviewer → orchestrator inspects evidence; Opus advisor on escalation. Git: per-phase branches, no remote/push/merge without approval.
- **Addendum 2026-11-19 (after Phase 0 execution) — Superpowers now available.** The statement above was true for the original Phase 0 run and is kept as a historical record. Afterwards, the user installed the Superpowers skills (`obra/superpowers` @ `22f0b46`, recorded in the repo's untracked `skills-lock.json`). They are installed as **standalone skills**, not as a plugin, so they are invoked without a namespace: `subagent-driven-development`, `executing-plans`, `test-driven-development`, `requesting-code-review`, `receiving-code-review`, `systematic-debugging`, `verification-before-completion`, `using-git-worktrees`, `finishing-a-development-branch`, `writing-plans`, `brainstorming`. Invocation was verified in-session (`using-superpowers`, `verification-before-completion` and the separate `playwright-cli` skill all loaded through the Skill tool). From Phase 1 onward these skills are invoked for real, and the manual protocol becomes the fallback only if a skill is unavailable.
