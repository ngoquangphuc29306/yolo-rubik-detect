# Phase 1 final verification report

Branch `refactor/phase-1-frontend`, HEAD `56aae9e`, written 2026-11-22 (task T1.19b). Phase 0 baseline commit `ad7c23b`; `main` is still at the Phase 0 merge `b53029b` (nothing from Phase 1 is merged; the branch is 47 commits ahead of `main`). All commands below were run in this task from `D:\Programming\AI\project\rubik-solver-yolo\frontend` in PowerShell (git commands from the repo root) unless stated. Results marked PASS / FAIL / NOT RUN / BLOCKED. Evidence that was NOT produced in this task is labelled with where it comes from (the per-task running log in Appendix A, the T1.19a browser findings, or the ledger).

**Scope statement.** This is a frontend-only, demo-mode result. There is no backend, no WebSocket server, no trained model and no physical-cube verification. Nothing here was verified on a physical cube, and the YOLO model does not exist. The desktop browser regression ran at commit `da110b7`; the later commit `56aae9e` changed two heading strings on the Reconstruction 2D Net (copy only) and was not re-run in a browser.

## 1. Summary table

| # | Area | Result | One-line evidence |
|---|---|---|---|
| 1 | Clean install (`npm ci` after deleting `node_modules`) | PASS | exit 0, "added 176 packages, and audited 183 packages in 13s", 0 vulnerabilities |
| 2 | Installed versions / extraneous packages | PASS | `npm ls --depth=0` exit 0, 27 top-level packages, no "extraneous" or "invalid" lines |
| 3 | Strict typecheck (`npm run lint`) | PASS | `tsc --noEmit` exit 0, no output; `tsconfig.json:12  "strict": true` |
| 4 | Full test run (`npm run test`) | PASS | exit 0; 37 test files, 761 tests passed, 0 failed; duration 13.16 s |
| 5 | Per-area test runs (11 directories) | PASS | all exit 0; sum 37 files / 761 tests (section 5) |
| 6 | Production build (`npm run build`) | PASS | exit 0; 2278 modules; built in 1.93 s; one chunk-size warning (known) |
| 7 | Static checks (legacy symbols, `@/src/`, removed deps, `.env`/weights) | PASS | all greps returned the expected result (section 5.3) |
| 8 | Git state | PASS | only `.claude/` and `skills-lock.json` untracked; no remotes; 3 local branches |
| 9 | Independent engine reference (500 seeded sequences, goldens, mutation checks) | PASS | `tests/reference` 24 tests and `tests/engine` 238 tests green (section 5.2); Python kociemba cross-check NOT RUN (Phase 2 gate) |
| 10 | Desktop browser and WebGL regression (1440x900) | PASS (19 of 20; 1 NOT RUN) | T1.19a at `da110b7`: 19 PASS, 0 FAIL, 1 NOT RUN (mobile, out of scope). Not re-run at `56aae9e` (copy-only change) |
| 11 | Move-direction table in the running app | PASS | all 18 steps of the demo scramble consistent (15 of the 18 move tokens; U, L2, B' not played), 0 post-state mismatches over 54 stickers per step (T1.19a item 3) |
| 12 | Mobile layout (390x844) | NOT RUN | out of scope by user decision (plan section 15); defects deferred |
| 13 | Live vision / backend / model | NOT RUN | no backend and no model exist; live mode is blocked by design and that block was observed (item 15, 17) |
| 14 | Physical cube verification | NOT RUN | never attempted; no physical cube was used |
| 15 | Python `kociemba` cross-check of the shared fixtures and the TS engine | NOT RUN | Phase 2 gate |
| 16 | Dev server, README `dev` / `preview` commands | NOT RUN in T1.19b (rule: no dev server in this task) | `npm run clean` run here: exit 0. `dev` loopback binding and proxy were verified in T1.18 (Appendix A) |
| 17 | Every commit on the branch built, linted and tested | NOT RUN in T1.19b | per-commit results were recorded by each task in Appendix A; not re-executed for all 47 commits |

## 2. Final repository directory structure

From `git ls-files` at `56aae9e` (193 tracked files). Directories with file counts:

```
(repo root)                    3 files   README.md, CLAUDE.md, .gitignore
docs/                          4 files   ARCHITECTURE.md, FRONTEND_PLAN_REVIEW.md, RUBIKVISION_CLAUDE_HANDOFF.md, legacy/ai-studio-metadata.json
docs/superpowers/              54 files  plans/ (1 plan), reports/ (phase0-baseline.md, phase1-verification.md, Phase 0 screenshots)
fixtures/                      9 files   health/ (3), solve/ (6): shared solve and health JSON
frontend/                      7 files   package.json, package-lock.json, index.html, tsconfig.json, vite.config.ts, vitest.config.ts, .env.example
frontend/public/               1 file    favicon.svg
frontend/src/                  App.tsx, main.tsx, index.css
  assets/                      1         bundled demo photo (webcam_cube_hands_*.jpg)
  components/                  12        BrandMark, FaceGrid2D, ModeBanner, WorkspaceHeader; three/ (RubiksCube3D, animation, webglUtils); ui/ (button, dialog, progress, slider, switch)
  demo/                        4         demo-fixtures, demo-solver, demo-scan-source, demo-errors
  engine/                      7         cube-state, facelet-geometry, move-engine, move-presentation, cubie-adapter, solve-binding, playback-fsm
  features/                    19        align/ (1), landing/ (1), review/ (ReconstructionScreen, stages), scanner/ (ScanningScreen, DemoViewport, LiveViewport, LiveUnavailablePanel, ScanGuidePanel, CapturedFacesPanel, ScanSettingsDialog, scan-guide, useDemoScanScript), solver/ (SolvingScreen, CompletionScreen, CountdownRing, MoveInfoPanel, OrientationCue, PlaybackDock)
  hooks/                       4         usePlayback, useCamera, useSolveSession, useBackendHealth
  lib/                         5         audio, colors, contain-transform, request-guard, utils
  services/                    6         api-config, health-client, parsers, readiness, scan-transport, solver-client
  stores/                      5         session-store, scan-store, cube-store, demo-session, solve-guard
  types/                       2         api, cube
frontend/tests/                47 files  architecture (1), components (8), config (1), demo (1), engine (8), features (2), golden (5 JSON), hooks (5), lib (3), reference (5: tests, vendored tables, PROVENANCE.md, licence), services (6), stores (2)
```

Counts per `frontend/src` folder come from `git ls-files`: components 12, demo 4, engine 7, features 19, hooks 4, lib 5, services 6, stores 5, types 2, plus 1 asset, App.tsx, main.tsx, index.css. Not tracked, by design: `backend/`, `training/`, weights, datasets, `.env`.

Totals: frontend/src 68 files, frontend/tests 47, frontend root config 7 plus public 1, fixtures 9, docs 58 (4 top-level plus 54 under `docs/superpowers`), repo root 3: 193.

## 3. Completed implementation checklist

Commit SHAs are matched by commit subject from `git log ad7c23b..HEAD`. "Fix rounds" and review verdicts come from the ledger `.superpowers/sdd/2026-11-19-frontend-refactor/progress.md`. The range `ad7c23b..HEAD` holds 54 commits: 7 Phase 0 commits (`c0bf1f3` .. `b53029b`), the plan-scope commit `e75d3a4`, and 46 commits after it.

| Task | Subject | Commits | Review result |
|---|---|---|---|
| T1.1 | Relocate to `frontend/` (mechanical) | `e0105ca` | one combined reviewer (R9); clean; 0 fix rounds |
| T1.2 | Test tooling, strict mode, characterization | `47d0685` | combined reviewer (R10); clean; 0 rounds; 5 minors parked to T1.3 |
| T1.3 | Canonical types, geometry, facelet state | `4fbad21`, fix `8d6ae32` | clean after 1 fix round (R/L orientation pinned) |
| T1.4a | Independent reference provenance | `fe4521f`, fix `b9a5909` | clean after 1 fix round (multiply order and physical pinning) |
| T1.4b | Move engine | `8fd3412` | clean; 0 rounds |
| T1.4c | `bindSolveResponse` | `e4fc5fd`, fix `b65de91` | clean after 1 fix round (malformed responses fail closed) |
| T1.5 | Renderer adapter, presentation, scan guide | `c30a95e`, fix `18bf3e8` | clean after 1 fix round |
| T1.6 | API types, parsers, guard, clients | `d468f9e` | clean; 0 rounds |
| T1.7 | Demo module | `e2566b3`, fix `b8b4bd7` | clean after 1 fix round |
| T1.8a | Session/scan/cube stores, `useSolveSession`, `useBackendHealth` | `8822a5d`, fix `7388d40` | clean after 1 fix round |
| T1.8b | One-way bridge from legacy store (later removed) | `5330ef0`, fix `2606eb1` | clean after 1 fix round (includes core cubie, R20) |
| T1.9 | Playback FSM (pure) | `3e32f4a`, hardening `bfc5bfc` | approved; 1 hardening round (R21) |
| T1.10 | `usePlayback` hook | `b76b9b3`, fix `71172c4` | clean after 1 fix round |
| T1.11 | `RubiksCube3D` controlled animation | `209cbd1` (+ R23 test-speed fix `344e55b`) | approved; 0 rounds |
| T1.12 | Solving screen | `03fa3f5` | spec 12/12, approved; 0 rounds |
| T1.13 | Alignment and Completion truthfulness | `ba816b5`, fix `6108c19` | clean after 1 fix round (N1 clipping, R24) |
| T1.14a | `contain-transform` and `useCamera` | `b4531eb`, fix `beb5e34` | clean after 1 fix round |
| T1.14b | Scanner demo/live split | `18b87b9`, fix `72cfae7` | clean after 1 fix round |
| T1.15 | Reconstruction on real data | `13e651a`, fixes `e720016`, `dc98864` | clean after 2 fix rounds |
| T1.15b | `runSolve` validates the request first | `b240a17` | clean; 0 rounds |
| T1.16 | Landing and mode banner | `876d286`, fix `e4c6096` | clean after 1 fix round |
| T1.17 | Legacy cutover removal | `7af06b4` (A), `c1b7c6e` (B), fix `020218f` | clean after 1 fix round (mode-aware restart, copy, guards) |
| T1.18 | Scaffold cleanup | `8affb58`, `d5c5e9d`, `f7bbee4` | combined reviewer; clean; 0 rounds |
| T1.19a | Desktop browser evidence | no repository commit (evidence in ignored `.superpowers/`) | controller verified; 19 PASS / 0 FAIL / 1 NOT RUN |
| T1.19b | Final verification run and this report | this commit | n/a |
| T1.20 | Architecture v1.1 and docs alignment | `72badc4`, `da110b7` | combined reviewer; spec and accuracy OK; 1 Important (plan section 16 wording) carried to T1.19b and fixed here |
| post-T1.19a | Reconstruction 2D Net finished-state heading (observation 2, ruling R34) | `56aae9e` | RED then GREEN recorded in the T1.15 report; no browser run |

Tasks with fix rounds: T1.3 (1), T1.4a (1), T1.4c (1), T1.5 (1), T1.7 (1), T1.8a (1), T1.8b (1), T1.9 (1 hardening), T1.10 (1), T1.13 (1), T1.14a (1), T1.14b (1), T1.15 (2), T1.16 (1), T1.17 (1). Zero rounds: T1.1, T1.2, T1.4b, T1.6, T1.11, T1.12, T1.15b, T1.18, T1.20.

### 3.1 Plan section 10 acceptance criteria

Criterion 11 reads "desktop only" per plan section 15.

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Git/baseline | PASS | Phase 0 report exists; branch layout: `chore/phase-0-baseline`, `main` (at `b53029b`), `refactor/phase-1-frontend`; `git ls-files | grep -E "(^|/)\.env$|\.pt$|\.onnx$"` empty; no merge, no remote (`git remote -v` empty). Phase 0 audit itself is documented in `phase0-baseline.md` sections 1-3 (read, not re-run) |
| 2 | `phase0-baseline.md` content | PASS | file read: sections 4-6 (toolchain, `npm ls`, D2 npm deviation), 9 (smoke), 15.2 (screenshots captured) |
| 3 | strict typecheck, tests green with counts, build | PASS | sections 6 and 7 here. "every commit on the branch built": NOT RUN in T1.19b; recorded per task in Appendix A |
| 4 | Engine vs independent reference | PASS | 500-sequence differential, hand goldens (incl. D, U', D'), `bindSolveResponse` valid-but-wrong test `(b)` and `(e)` in `tests/engine/solve-binding.test.ts`; demo outcomes strict-parsed, bound and replayed (`tests/demo`, 15 tests). Reference shares the Kociemba facelet convention; Python cross-check is NOT RUN |
| 5 | Demo vs live | PASS | T1.19a items 1, 14, 15, 17; unit tests in `tests/components/ScanningScreen.test.tsx`, `tests/demo`. Wire `SolveResponse` has no provenance field (T1.7 test) |
| 6 | Orientation | PASS | cue shows "Top: White Front: Green Right: Red" (T1.19a item 9) and is tested with non-demo centres (T1.5, T1.12 tests); not separately grepped in T1.19b |
| 7 | Playback | PASS | `tests/engine` playback-fsm (67 tests at T1.9-R21) and `tests/hooks/usePlayback.test.tsx`; browser items 4-8, 10 (pause freeze delta 0, replay, countdown, pace, hidden tab, final wait). Prev/Next and `SKIP_WAIT` absent; `MoveInfoPanel` shows PREV/CURRENT/NEXT as read-only labels |
| 8 | Async races | PASS | stale guards and camera tests in `tests/lib`, `tests/hooks`, `tests/stores` (automated, fake streams); browser camera lifecycle with Chrome's synthetic device (item 16). Late `getUserMedia` resolution is unit-tested only |
| 9 | Empty solution | PASS (automated); browser NOT RUN | unit tests only; not reachable from the demo UI (every demo has 18 moves) |
| 10 | Completion | PASS | Guidance Time 1:45 = 105.015 s accumulated playback, label states it is not time to solve; no confetti before confirm (item 11) |
| 11 | Visual regression, desktop 1440x900 | PASS with caveat | six screens compared by viewing screenshots and reading DOM text against the Phase 0 screenshots, not by pixel diff. Intentional differences listed in section 9.2. Direction table executed: 18/18. Run predates `56aae9e` |
| 12 | Scaffold | PASS | 7 unused packages removed, lockfile 403 to 244 entries (0 added, 0 version changes) per T1.18 (Appendix A); static greps and `npm ls` re-run here. "no empty directories or unused modules": not separately audited in T1.19b |
| 13 | `fixtures/` shared JSON | PASS | 9 files (`health/` 3, `solve/` 6), loaded by `tests/services/fixtures.ts` and 10 test files |
| 14 | Nothing from Phase 2+ started | PASS | no `backend/` or `training/` tracked (0 files), no weights, no WebSocket server |

## 4. Summary of source changes

From `git diff --no-renames --name-status ad7c23b..HEAD`: 186 added, 30 deleted, 4 modified (220 paths). With rename detection: 199 files changed, 29686 insertions, 3881 deletions (`git diff --stat ad7c23b..HEAD | tail -3`). Production source `frontend/src`: 68 added files, +7550 lines. Tests `frontend/tests`: 47 added files, +19967 lines (12291 of them in 5 golden JSON files). Removed legacy `src/` (23 files, 5164 lines of TS/TSX plus config).

| Area | Files (added) | Description |
|---|---|---|
| `frontend/src/engine` | 7 | Pure canonical cube: 54-facelet state, integer facelet geometry, 18-move engine, renderer adapter (27 cubies including the stickerless core), presentation metadata, `bindSolveResponse` (replay-to-solved), playback reducer (single clock, generations) |
| `frontend/src/services` + `types` | 6 + 2 | Typed, runtime-validated parsers and clients for `/health` and `/api/solve`, readiness derivation, scan transport (status only; no WebSocket client is implemented), API and cube types |
| `frontend/src/stores` | 5 | Zustand session, scan and cube stores; `solve-guard` (one cancellation owner); `demo-session` (mode-aware restart) |
| `frontend/src/hooks` | 4 | `usePlayback` (rAF clock, hidden-tab pause, `frameRef`), `useCamera` (one stream, stop-on-failure), `useSolveSession`, `useBackendHealth` |
| `frontend/src/demo` | 4 | Explicit, labelled demo fixtures and solver; demo scan source |
| `frontend/src/features` | 19 | The six screens split by workflow; real validation stages on Reconstruction; demo/live scanner split; playback-driven Solving screen; truthful Alignment and Completion; Landing with explicit Demo / Live entry |
| `frontend/src/components` + `lib` | 12 + 5 | Shared UI, `ModeBanner`, controlled `RubiksCube3D` (`reconcile`, `frameRef`), contain-fit transform, request guard, colours, audio |
| Config | 8 | `package.json` (7 packages removed), lockfile, loopback-only Vite config with backend proxy (`/api`, `/health`, `/ws`), `vitest.config.ts`, strict `tsconfig.json`, favicon, `.env.example` |
| `frontend/tests` | 47 | See section 5 |
| `fixtures/` | 9 | Shared solve and health JSON for frontend now and backend later |
| `docs/` | 54 added, 2 modified | `docs/legacy/ai-studio-metadata.json` added; ARCHITECTURE v1.1 and the plan (sections 15-16) modified; 53 report files added (Phase 0 report and screenshots, this report) |
| Deleted | 30 | Legacy `src/` (cubeEngine, useRubikStore, six screens, old components), `bun.lock`, `metadata.json` (archived to `docs/legacy/`), root `package.json`/`tsconfig.json`/`vite.config.ts`/`index.html` (moved to `frontend/`) |

## 5. Regression test results (fresh)

### 5.1 Totals and per area

`npm run test` (`vitest run`, Vitest v5.1.1): exit 0, "Test Files  37 passed (37)", "Tests  761 passed (761)", duration 13.16 s. Each directory was also run separately with `npx vitest run tests/<dir>` (all exit 0):

| Area | Files | Tests | Exit |
|---|---|---|---|
| `tests/engine` | 8 | 238 | 0 |
| `tests/services` | 5 | 46 | 0 |
| `tests/stores` | 2 | 32 | 0 |
| `tests/hooks` | 5 | 104 | 0 |
| `tests/components` | 8 | 180 | 0 |
| `tests/features` | 2 | 77 | 0 |
| `tests/demo` | 1 | 15 | 0 |
| `tests/architecture` | 1 | 13 | 0 |
| `tests/reference` | 1 | 24 | 0 |
| `tests/lib` | 3 | 24 | 0 |
| `tests/config` | 1 | 8 | 0 |
| Sum | 37 | 761 | |

`tests/golden` holds 5 JSON files and no test files. Count history: 760 at T1.18 and T1.20 (T1.20 report), 761 now, because `56aae9e` added one test (the 2D Net heading test, ledger R34).

### 5.2 Independent reference verification

Source: `frontend/tests/reference/PROVENANCE.md` (read) and the green `tests/reference` and `tests/engine` runs above.

- Reference: cubie-level tables transcribed from `ldez/cubejs` (MIT) at pinned commit `6b3da493894d9aed54f4c8aafccadbe676e745b5` (`src/cube.coffee`, sha256 `8b161bb9...5c4a`, retrieved 2026-11-20). Only numeric tables were vendored; the CoffeeScript was never executed; no code shared with `src/`.
- Reference self-test (24 tests in this run): solved string, `m^4 = id`, `m2 m2 = id`, `m m' = id`, order of `R U R' U'` is 6, order of `R U` is 105, centres fixed, colour counts, hand-derived U move, plus the reversed-order and orientation pins added in the T1.4a fix round.
- Engine vs reference: a seeded 500-sequence differential covering all 18 tokens, compared after every move (seed `0x5eed1234`, per the T1.4b log row in Appendix A), plus 9 hand-derived goldens including D, U' and D'. No disagreement.
- Mutation checks recorded in the ledger: the T1.4a fix round showed reversed-order and orientation (eo) mutants fail; T1.15 and T1.16 recorded mutations on `solveRequestGuard.reset` and `startSession` resets failing the expected tests. The T1.4a reviewer noted that no co-mutation run was done and only one non-commuting sequence is pinned. Mutation runs were not repeated in T1.19b.
- Limitation: reference and engine both use the published Kociemba facelet convention, so a shared conceptual error is still possible. The Python `kociemba` cross-check is NOT RUN (Phase 2 gate).

### 5.3 Static evidence

| Command | Result |
|---|---|
| `git grep -nE "lib/cubeEngine\|useRubikStore" -- frontend/src frontend/tests` | PASS: hits only in `frontend/src/engine/move-presentation.ts:2` (a comment), the architecture guard's own patterns and fixtures in `frontend/tests/architecture/boundaries.test.ts`, and `source` provenance strings in 4 `tests/golden/*.json` files. No import |
| `git grep -nE "targetFaces\|STICKER_CONFIDENCES\|generateScrambleSession" -- frontend/src` | PASS: no match (exit 1) |
| `git grep -nE "@/src/" -- frontend/src` | PASS: no match |
| `git grep -nE "from '(@google/genai\|dotenv\|express\|motion)'" -- frontend/src` | PASS: no match |
| `git ls-files \| grep -E "(^\|/)\.env$\|\.pt$\|\.onnx$"` | PASS: no match |

## 6. Strict TypeScript verification

- `frontend/tsconfig.json` line 12: `"strict": true` (target `ES2022`, line 3).
- `npm run lint` (`tsc --noEmit`, TypeScript 7.0.2): exit 0, no diagnostics. PASS.

## 7. Production build

`npm run build` (`vite build`, Vite 8.3.8): exit 0, "2278 modules transformed", "built in 1.93s". Output in `frontend/dist` (removed again with `npm run clean`, exit 0):

| File | Size |
|---|---|
| `dist/index.html` | 1.57 kB (gzip 0.71 kB) |
| `dist/assets/index-CfZDg3J5.css` | 58.27 kB (gzip 10.21 kB) |
| `dist/assets/index-DdwnArAB.js` | 1,340.24 kB (gzip 370.45 kB) |
| `dist/assets/webcam_cube_hands_1795070971051-BfmUXgZI.jpg` | 709.99 kB (bundled demo photo, separate hashed asset) |
| `dist/favicon.svg` | 435 bytes |

One warning: "Some chunks are larger than 500 kB after minification" (single JS chunk; accepted, no code splitting in Phase 1). No other warnings.

### 7.1 Installed versions (`npm ls --depth=0`)

react 19.3.1, react-dom 19.3.1, three 0.187.0, @react-three/fiber 9.8.2, @react-three/drei 10.7.9, zustand 5.1.0, tailwindcss and @tailwindcss/vite 4.3.5, vite 8.3.8, @vitejs/plugin-react 6.3.0, typescript 7.0.2, vitest 5.1.1, jsdom 31.0.1, @testing-library/react 16.3.3, @testing-library/dom 10.4.2, @testing-library/jest-dom 8.0.0, @testing-library/user-event 14.6.13, canvas-confetti 1.9.4, lucide-react 0.546.0, class-variance-authority 0.7.1, clsx 2.1.1, tailwind-merge 3.7.0, @types/node 22.20.5, @types/react 19.3.0, @types/react-dom 19.3.0, @types/three 0.187.0, @types/canvas-confetti 1.9.0. No extraneous packages.

## 8. Desktop browser and WebGL verification

Method (T1.19a, `t119-browser-findings.md`): Vite dev server from `frontend/` on 127.0.0.1:5173, no backend; system Chrome through `playwright-cli` (headless), Chrome fake media flags, Playwright fake clock installed before the first navigation; viewport 1440x900; hardware WebGL (ANGLE, NVIDIA GeForce GTX 1060 3GB, Direct3D11); 78 screenshots in `.superpowers/sdd/2026-11-19-frontend-refactor/shots/t119/` (git-ignored, not committed). **The run happened at HEAD `da110b7`. Commit `56aae9e` (copy only: the Reconstruction 2D Net heading after validation) came afterwards and was not re-run in a browser.** Browser results below are taken from that findings file, not re-executed in T1.19b.

| # | Item | Result | Evidence summary |
|---|---|---|---|
| 1 | Six screens and simulated-scan walk-through | PASS | all six screens rendered; amber DEMO strip; "SIMULATED FEED"; colour-code-only overlay; "Detection Confidence: Simulated"; auto-capture of F,R,B,L,U,D then Reconstruction |
| 2 | WebGL renderer and cube on 5 screens | PASS | hardware renderer; cube visible on Landing, Reconstruction 3D Twin, Alignment, Solving (139 meshes), Completion |
| 3 | Move directions, 18 moves, mid and post | PASS | see table below |
| 4 | Pause mid-rotation | PASS | D' paused at about 50 percent: layer angle -41.79 deg then -41.79 deg 500 ms later, max sticker delta 0; smooth resume to the predicted position |
| 5 | Replay | PASS | replay restarts from S[1], ends at S[2], not applied twice; mid-animation replay restarts without changing the step |
| 6 | Countdown | PASS | about 1 s per decrement, frozen while paused, resumes from the frozen value, advances at 0 |
| 7 | Pace | PASS | 2 s vs 15 s waits differ; a mid-wait change does not alter the current wait |
| 8 | Hidden tab | PASS (wait phase only) | pauses, no auto-resume on visible, deliberate Resume continues from the frozen value; hidden during animation not separately run |
| 9 | Orientation cue | PASS | "Top: White Front: Green Right: Red" visible and unchanged after orbit to back and bottom (screen-space HUD) |
| 10 | Final delay completes | PASS | final 5 s wait ran in full (5,4,3,2,1 then Done); Completion about 900 ms after |
| 11 | Completion | PASS | Guidance Time 1:45; no confetti canvas before confirm; exactly one after confirm and removed within 16 s; "Digital twin" labels visible; cube margin at least 34 px over 6 rotation phases |
| 12 | Reconstruction honesty / invalid state | PASS | six real stages, "Demo fixture" labels, no "Kociemba", no "54 stickers detected"; invalid state: stage 4 red, 5-6 pending, no green net borders; restore works |
| 13 | Alignment Start button inside viewport | PASS | button bottom 884 px at 900 px; page scrollHeight 929 (29 px taller than the viewport) |
| 14 | Simulated scan conditions | PASS | 7 states render; no confidence decimals anywhere; percentages appear only next to "Demo: scripted stability" |
| 15 | LIVE mode unavailable | PASS | no DEMO banner; "Vision service is not running ... Nothing is simulated in live mode"; Capture disabled; no overlay boxes; 0 `getUserMedia` calls on mount |
| 16 | Camera lifecycle (synthetic device only) | PASS | device label `fake_device_0`; tracks `ended` and `srcObject` null on brand-button exit, Restart Scan and Turn off camera; 0 video elements and 0 gUM calls from Reconstruction to Completion. Reload-time cleanup not inspectable |
| 17 | Missing backend / model | PASS | `/health` and `/api/solve` return 502 through the proxy; Retry works with no fallback to demo |
| 18 | Console | PASS | only the known `THREE.Clock` deprecation warning (x9) and the expected 502 health errors and aborted health requests; no page errors; no favicon 404 |
| 19 | Overflow at 1440x900 | PASS | `scrollWidth == innerWidth == 1440` on 10 views (vertical overflow only on Alignment, see item 13) |
| 20 | Mobile 390x844 | NOT RUN | out of scope by user decision |

Totals: 19 PASS, 0 FAIL, 1 NOT RUN.

### 8.1 Move direction table (item 3)

Method: not screenshots alone. The Playwright clock was advanced so each move was sampled at pre (about 64 ms), mid (50 percent of the animation) and post (duration plus 50 ms). Every coloured sticker's world position was read from the live three.js scene (via the `__THREE_DEVTOOLS__` observe hook, installed with `addInitScript`; no repository change). Expected motion came from the user-facing table (R front column up, L down, U front row left, D right, F top row right, B top row left, primes opposite, doubles 180 degrees), not from repository code. Checks per move: (a) exactly the 21 stickers of the target layer move at mid and none outside it; (b) each moving sticker's signed angle at mid equals the expected half-way angle; (c) at post all 54 stickers sit at the table-predicted positions with the same colour. Measured mid angles lag the ideal 45/90 degrees by 0-6 degrees (1-2 frames of render latency at the steepest part of the easing); signs all correct. Screenshots (mid and post per move, 36 files) were additionally viewed for steps 1, 13/14 and 16/17.

| Step | Move | Observed motion (table expectation) | Mismatches at post | Verdict |
|---|---|---|---|---|
| 1 | D' | LEFT, front-bottom row | 0 | consistent |
| 2 | F | RIGHT, top row of F layer | 0 | consistent |
| 3 | U' | RIGHT, front-top row | 0 | consistent |
| 4 | R2 | UP (half), front column | 0 | consistent |
| 5 | B | LEFT, top row of B layer | 0 | consistent |
| 6 | D2 | RIGHT (half), front-bottom row | 0 | consistent |
| 7 | L | DOWN, front-left column | 0 | consistent |
| 8 | U' | RIGHT, front-top row | 0 | consistent |
| 9 | F' | LEFT, top row of F layer | 0 | consistent |
| 10 | R | UP, front-right column | 0 | consistent |
| 11 | U2 | LEFT (half), front-top row | 0 | consistent |
| 12 | B2 | LEFT (half), top row of B layer | 0 | consistent |
| 13 | L' | UP, front-left column | 0 | consistent |
| 14 | D | RIGHT, front-bottom row | 0 | consistent |
| 15 | F2 | RIGHT (half), top row of F layer | 0 | consistent |
| 16 | R | UP, front-right column | 0 | consistent |
| 17 | U' | RIGHT, front-top row | 0 | consistent |
| 18 | R' | DOWN, front-right column | 0 | consistent |

Coverage note: the 18 steps of the demo scramble (`D' F U' R2 B D2 L U' F' R U2 B2 L' D F2 R U' R'`) use 15 of the 18 move tokens. U (clockwise), L2 and B' did not occur and were NOT checked in the browser; they are covered by the engine's differential and golden tests only. All six faces were exercised; both senses were seen for R, L, D and F, only the prime for U and only the clockwise turn for B.

### 8.2 Earlier browser checks by implementers (supporting evidence, not re-run)

Recorded per task in Appendix A: T1.11 (legacy path, Landing/Reconstruction/Alignment cubes), T1.12 (pause mid-D' freeze, resume, countdown, replay, pace, orientation cue after orbit, D and U' directions, all 18 moves to Completion), T1.13 (Alignment, Completion copy, confetti only after confirm, Guidance Time 1:45; N1 measured at 25 px minimum margin over 8 frames after the fix), T1.14b (demo scanner states, no numeric confidences), T1.15 (stages, invalid and restore paths), T1.16 (banner on three screens, live panel, fake-device camera lifecycle), T1.17B and T1.18 (full demo flow, console clean except the known warnings). Mobile and live-with-backend were NOT RUN in all of them.

## 9. Baseline comparison findings

### 9.1 Phase 0 defects

Source: `phase0-baseline.md` sections 10 and 15 and plan section 1.2. Baseline statuses: F1-F7 confirmed by reading; F8, F13, F1 and N1-N6 reproduced in the browser (section 15.3); F10 NOT REPRODUCED in Phase 0.

| ID | Defect | Phase 1 status | Evidence |
|---|---|---|---|
| F1 | Fake confidences and detection numbers | FIXED | no numeric confidences; labelled demo (T1.19a items 1, 14); unit tests in `ScanningScreen.test.tsx` |
| F2 | Fake boxes over a mirrored real webcam | FIXED | live preview is unmirrored (`transform: none`), contain-fit, no overlay boxes (items 15, 16) |
| F3 | Capture copies the preset | FIXED | live capture is disabled without a vision connection (item 15); demo captures come from the labelled demo scan source |
| F4 | Reconstruction fills in missing data, timer-based checklist | FIXED | six real stages derived from validation and the solve outcome (item 12; `tests/features/review`) |
| F5 | "Solution" is the reversed scramble, labelled Kociemba | PARTIALLY FIXED | relabelled "Demo solution (pre-computed)" and verified by binding and replay; a real solver does not exist (Phase 2) |
| F6 | Hard-coded orientation and centre colours | FIXED | guidance and cue derive from observed centres (item 9; adapter and scan-guide tests with non-demo centres). Landing marketing prose is unrelated to this |
| F7 | Silent `'W'` fallback | FIXED | fail closed (T1.5 tests); unit-test evidence only |
| F8 | Animation ignores pause | FIXED | item 4: frozen layer, delta 0 |
| F9 | Timers unreliable (setInterval, hidden tab, stale closure) | FIXED | one rAF playback clock; items 6, 8; `usePlayback` tests |
| F10 | Replay/step-back races | NOT REPRODUCED in Phase 0; Prev/Next removed | item 5 (replay), `usePlayback` tests |
| F11 | Empty-solution NaN | FIXED (unit tests); browser NOT RUN | not reachable from the demo UI |
| F12 | Stale callbacks after rescan | FIXED (unit tests); partial browser | generation guards (`tests/stores`, `tests/hooks`); camera and Scan Again exercised in item 16 |
| F13 | Padded completion time, auto-confetti | FIXED | item 11: Guidance Time 1:45, confetti only after confirm |
| F14 | Auto-start of solving | FIXED | T1.13 browser row: Replay Solution returns to Alignment with Start shown, no autoplay |
| N1 | Completion cube clipped | FIXED on desktop; mobile part DEFERRED | item 11: margin at least 34 px |
| N2 | Mobile Solving oversized, clipped | DEFERRED (mobile) | item 20 NOT RUN |
| N3 | "Parity check failed" vs colour-count message | FIXED | item 12: "Rejected by validation" with a consistent message |
| N4 | "Loading AI Model" option has no effect | FIXED | item 14: "Starting demo feed" |
| N5 | Speed applies to the current countdown | FIXED | item 7 |
| N6 | Favicon 404 and `THREE.Clock` warning | favicon FIXED; Clock warning UNCHANGED by decision | item 18: no favicon 404; warning x9 remains (three.js not upgraded) |
| N7 | Mobile Reconstruction opens on the 3D Twin tab | DEFERRED (mobile) | on desktop the first tab is now the 3D Twin (baseline: 2D Net), consistent across runs |

### 9.2 Intentional visual differences vs the baseline desktop screenshots

From T1.19a (comparison by viewing and DOM text):
- Amber DEMO strip (28 px) on demo screens, shifting content down about 28 px.
- Landing: caption under the CTAs ("Demo uses a built-in cube and a pre-computed solution"), hero caption "Illustration - simulated digital twin" replacing "Reconstructed 3D Digital Twin 54/54 valid", Landing technology metrics reworded without unmeasured numbers, hero cube is the demo scramble.
- Scanning (demo): "SIMULATED FEED" tag, header "Simulated Camera" (was "Camera Active"), overlay labels are colour letters only, "Detection Confidence: Simulated", "Demo: scripted stability", "Switch to Real Webcam" removed, "Skip to Reconstruction" only after the first capture.
- Reconstruction: six real stages with "Demo fixture" details, "Demo Solution 18 moves, demo, pre-computed" replacing "Kociemba Solution", opens on the 3D Twin tab, 2D Net heading after validation changed in `56aae9e` (not browser-verified).
- Alignment: tighter spacing so the Start button stays in view; cube fully inside its card.
- Solving: header "Step N of 18", no Previous/Next buttons, added Top/Front/Right orientation cue, bottom dock with Pause, Replay, Pace, Angle lock and sound.
- Completion: "DEMO GUIDANCE COMPLETE", "Guidance Time" label, no confetti before confirm, cube fits its card, "Digital twin" labels.

## 10. Agent model allocation summary

- Every subagent was dispatched with the explicit model parameter `sonnet` (Sonnet 5.5). The subagents' runtime model identity is not observable from the session, so `sonnet` is the REQUESTED model, not a verified one.
- The controller session's own model was changed by the user over time through `/model` commands (Opus 5.5 earlier in the project, Sonnet 5.5 later). From 2026-11-22 the user instructed Sonnet 5.5 only, for the controller and all subagents; the earlier Opus-advisor role in the plan (section 14 and the early rulings) was superseded by that instruction.
- The Superpowers skills `subagent-driven-development` and `verification-before-completion`, and `playwright-cli`, were invoked as installed standalone skills (registered names, no `superpowers:` prefix).
- Each implementer was followed by independent reviewer agents: two fresh reviewers (spec compliance, then code quality) for behavioural tasks, and a single combined reviewer with both verdicts for mechanical or docs-only tasks (T1.1, T1.2, T1.18, T1.20), per rulings R9 and R10.
- Fix loops: tasks that needed fix rounds and how many: T1.3 (1), T1.4a (1), T1.4c (1), T1.5 (1), T1.7 (1), T1.8a (1), T1.8b (1), T1.9 (1 hardening), T1.10 (1), T1.13 (1), T1.14a (1), T1.14b (1), T1.15 (2), T1.16 (1), T1.17 (1). Review verdicts and rounds are in the ledger; implementer self-reports were checked by the controller by re-running tests, lint and build and by viewing screenshots.

## 11. Architecture v1.1 and CLAUDE.md edits

- The model-last amendments to `docs/ARCHITECTURE.md` (v1.0 to v1.1: model rules, start convention, FaceletState/27 cubies, playback as built, readiness, contract-only ROI/transport, Demo vs Live section 9.1, verification sections 12.1-12.2, roadmap section 13, added risks) are in commits `72badc4` and `da110b7`. Section 12.1 was corrected again in this task (see the second commit).
- `CLAUDE.md` edits (four, listed in `.superpowers/sdd/2026-11-19-frontend-refactor/task-1.20-report.md`): (1) roadmap pointer now says Phase 1 is implemented on `refactor/phase-1-frontend` and awaits approval and merge, with evidence in this report and Phase 2 needing its own design; (2) package-manager statement: npm, `frontend/package-lock.json` only, Bun no longer used, commands run from `frontend/`; (3) Install line is `npm ci` only; (4) Frontend commands line lists the concrete npm commands. No other CLAUDE.md change was made in T1.19b (no inaccuracy found).
- README: one earlier fix in T1.20 ("every demo workflow screen"). No README change in T1.19b.

## 12. Known limitations and deferred work

- Mobile layout is deferred by user decision: Phase 0 N1 (mobile part), N2, N7.
- `THREE.Clock` deprecation warning remains (three.js not upgraded, by decision).
- The production bundle is one JS chunk of about 1.3 MB (1,340.24 kB).
- Windows drive-letter Vitest quirk: Vitest can fail with `reading 'config'` when the shell's drive-letter case differs from the working directory; run it from PowerShell. Not hit in this task.
- Alignment page is 29 px taller than the viewport at 1440x900 (scrollHeight 929); the Start button is inside (bottom 884).
- The 3D twin is slightly clipped at the bottom on Reconstruction (y about 696), as in the baseline; Landing cube tip overlaps the caption row (as in baseline). On Completion the rotating cube comes within 0-10 px of the label row in some phases, never overlapping in viewed frames.
- Landing marketing prose still says the Kociemba solver validates "all 54 detected stickers". That is a product description of the intended system, not a measured result; no model or solver service exists.
- The demo scanning screen shows scripted percentages next to "Demo: scripted stability" (labelled; not a detection confidence).
- Browser gaps: hidden tab was tested during a wait phase only; reload-time track cleanup could not be inspected on the destroyed document; the orientation cue was checked as a screen-space HUD; the empty-solution path and reduced-motion path are unit-tested only; live mode with a real backend was never run. The browser regression predates `56aae9e`. Direction table: the demo scramble does not contain U (clockwise), L2 or B' (section 8.1).
- Mid-turn layer angle lags the ideal easing by 1-2 frames (0-6 degrees at 50 percent).
- Optional copy follow-up (ledger): Landing wording "AI recreates your physical cube" and "eliminate false captures" is optimistic.
- Fonts load from Google Fonts at runtime (third-party request); self-hosting is a tracked follow-up.

### 12.1 TDD gaps disclosed during execution

- T1.8a fix round 1: tests were written after the fix (no RED captured). T1.8b fix round 1: tests written with the fix (no RED); the constraint was then changed to require RED in fix rounds, and the T1.8b ledger note states all new tests fail at the base by reasoning, not by a captured run.
- T1.9 hardening (R21): the exact-phase-boundary fractional-dt tests passed before the fix, so no failure was reproduced for that item; the other four items had RED.
- T1.17: the demo-session API had only partial RED (commit A: 2 failed of 10 in the stashed run).
- T1.14b: 15 of 38 new tests were RED; the rest are regression guards with no possible RED.
- The playback property test (R23) could not be made RED: it passed in 3.2 s on the faster machine and only exceeded the 5 s timeout on the slower one. It was rewritten to about 50 ms with its coverage kept.
- T1.11 and T1.14a were not wired to a browser at the time (verified later in T1.12/T1.16 and T1.19a).

### 12.2 Execution incident and blocker

- The T1.20 brief file was initially a stub because a shell command (heredoc) failed; it was rewritten before the agent proceeded (ledger note at T1.18).
- Test-speed blocker (R23): at `209cbd1` the controller found `playback-fsm` property test taking 9-19 s, so `npm run test` failed (1 failed of 553) despite the implementer's claim; fixed in `344e55b` and the full suite then passed repeatedly.
- A transient "forks worker" error appeared once when chaining commands at T1.15b; it was not reproducible standalone.

## 13. Local development instructions and Phase 2 readiness

README commands (from `frontend/`) and what was run in T1.19b:

| Command | Result |
|---|---|
| `npm ci` | PASS (exit 0) |
| `npm run lint` | PASS (exit 0) |
| `npm run test` | PASS (exit 0, 761 tests) |
| `npm run build` | PASS (exit 0) |
| `npm run clean` | PASS (exit 0, `dist` removed) |
| `npm run dev` (http://127.0.0.1:5173, proxy to 127.0.0.1:8000) | NOT RUN in T1.19b (no dev server by instruction); T1.18 verified loopback-only listening and 502 from the proxy (Appendix A) and T1.19a ran the dev server |
| `npm run preview` (http://127.0.0.1:4173) | NOT RUN |

### Readiness for Phase 2 (not started)

Ready: typed, runtime-validated contracts (`types/api.ts`, `services/parsers.ts`); shared solve and health fixtures at repo-root `fixtures/`; `bindSolveResponse` (request/response/centre binding and replay-to-solved); `runSolve` that validates the request before any call; fail-closed readiness derivation; Vite proxy config for `/api`, `/health`, `/ws`.

Phase 2 must do (needs its own design and plan, not started): FastAPI `GET /health` and `POST /api/solve` with Pydantic schemas; canonical reconstruction and validation (edge/corner legality, orientation sums, parity); real Kociemba; a Python `kociemba` cross-check of the shared fixtures and of the independent reference; backend response schemas aligned with `fixtures/`. Stop conditions: any disagreement between the Python solver and the TypeScript engine or fixtures, any contract conflict, or any need to change the public contract without approval.

State plainly: nothing in this repository was verified on a physical cube, and the YOLO model does not exist. A finished demo only means the guidance finished.

---

## Appendix A: per-task running log (verbatim)

The content below is the running log exactly as the implementers wrote it during Phase 1 (the title line, branch note, "Running log" table and "Notes"). It was not edited.

Branch `refactor/phase-1-frontend`. All commands run from `frontend/` unless noted. Results are copied from actual command output.

## Running log

| Task | Command | Exit | Result |
|---|---|---|---|
| T1.2 | `npm install -D vitest@5.1.1 jsdom@31.0.1 @testing-library/react@16.3.3 @testing-library/dom@10.4.2 @testing-library/jest-dom@8.0.0 @testing-library/user-event@14.6.13` | 0 | added 67 packages, 0 vulnerabilities. Peer ranges checked first with `npm view`: vitest 5.1.1 accepts vite ^6.4 / ^7 / ^8 (installed 8.3.8) and @types/node ^22. |
| T1.2 | `npm run test` | 0 | 3 test files passed, 114 tests passed, 0 failed (legacy engine characterization incl. 75 invariance checks, legacy goldens, architecture guard). |
| T1.2 | `npm run lint` (`tsc --noEmit`, `strict: true`) | 0 | no errors. |
| T1.2 | `npm run build` (`vite build`) | 0 | built in 721ms; existing chunk-size warning (>500 kB) unchanged. |
| T1.3 | `npx vitest run tests/engine/facelet-geometry tests/engine/cube-state` (RED, before impl) | 1 | 2 test files failed: `Cannot find package '@/engine/facelet-geometry'` (modules absent, expected). |
| T1.3 | same command (GREEN) | 0 | 2 files passed, 24 tests passed. |
| T1.3 | `npm run test` | 0 | 5 test files passed, 139 tests passed, 0 failed (adds geometry, cube-state, tightened architecture guard incl. temp-fixture scan test). |
| T1.3 | `npm run lint` (`tsc --noEmit`) | 0 | no errors. |
| T1.3 | `npm run build` | 0 | built in 735ms; existing chunk-size warning unchanged. |
| T1.4a | `curl -fsSL` of ldez/cubejs `src/cube.coffee` and `LICENSE` at SHA 6b3da49 (not executed) | 0 | sha256 recorded in `frontend/tests/reference/PROVENANCE.md`; licence MIT. |
| T1.4a | `npx vitest run tests/reference` (RED, before impl) | 1 | file failed: cannot resolve `./cubie-reference` (module absent, expected). |
| T1.4a | same command (GREEN) | 0 | 1 file, 12 tests passed (incl. order 6 / 105 and hand-derived U move). |
| T1.4a | `npm run test` | 0 | 6 test files passed, 155 tests passed, 0 failed. |
| T1.4a | `npm run lint` (`tsc --noEmit`) | 0 | no errors. |
| T1.4a | `npm run build` | 0 | built in 839ms; existing chunk-size warning unchanged. |
| T1.4b | `npx vitest run tests/engine/move-engine` (RED, before `move-engine.ts`) | 1 | file failed to load: `@/engine/move-engine` could not be resolved (module absent, expected); 0 tests ran. |
| T1.4b | same command (GREEN) | 0 | 1 file, 44 tests passed: 18-token parser, 9 hand-derived goldens, 500-sequence differential vs pinned reference (seed 0x5eed1234, every move), properties (incl. order 105), snapshots/verify, legacy golden cross-check, presentation parity. No engine/reference disagreement. |
| T1.4b | `npm run test` | 0 | 7 test files passed, 211 tests passed, 0 failed. |
| T1.4b | `npm run lint` (`tsc --noEmit`) | 0 | no errors (after typing the test helper `run` as `FaceletState`). |
| T1.4b | `npm run build` | 0 | built; existing chunk-size warning unchanged. |
| T1.4c | `npx vitest run tests/engine/solve-binding tests/engine/move-engine` (RED, before impl) | 1 | solve-binding suite failed to load (`@/engine/solve-binding` absent, expected); move-engine: 2 new R11 tests failed (`applyMove`/`verifySolution` accepted `toString`/`__proto__`), 45 passed. |
| T1.4c | `npm run test` (GREEN) | 0 | 8 test files passed, 227 tests passed, 0 failed (cases (a)-(g), invalid request, illegal tokens, non-demo centres, R11 hardening). |
| T1.4c | `npm run lint` (`tsc --noEmit`) | 0 | no errors. |
| T1.4c | `npm run build` | 0 | built; existing chunk-size warning unchanged. |
| T1.5 | `npx vitest run tests/engine/cubie-adapter tests/features` (RED, before impl) | 1 | both files failed to load: `@/engine/cubie-adapter` and `@/features/scanner/scan-guide` absent (expected); 0 tests ran. |
| T1.5 | `npm run test` (GREEN) | 0 | 10 test files passed, 275 tests passed, 0 failed (adapter: solved parity, 18-token differential vs legacy applyMove, round-trip, custom centres, throws, ids; scan-guide: legacy text parity, no colour words for unknown centres). |
| T1.5 | `npm run lint` (`tsc --noEmit`) | 0 | no errors (after typing test fold as `reduce<FaceletState>`). |
| T1.5 | `npm run build` | 0 | built; existing chunk-size warning unchanged. |
| T1.6 | `npx vitest run tests/services` (RED, before impl) | 1 | all 5 suites failed to load (`@/services/*`, `@/lib/request-guard` absent, expected); 0 tests ran. |
| T1.6 | `npx vitest run tests/services` (GREEN) | 0 | 5 files passed, 44 tests passed (parsers incl. extra-key/type/centre/token/moveCount rejection, error-typing exhaustive switches, fixtures + bindSolveResponse + reference replay, guard stale success/error and reset, solver-client, health-client + deriveLiveReadiness, scan transport). |
| T1.6 | `npm run test` | 0 | 15 files passed, 379 tests passed, 0 failed (architecture guard green with services/). |
| T1.6 | `npm run lint` (`tsc --noEmit`) | 0 | no errors. |
| T1.6 | `npm run build` | 0 | built; existing chunk-size warning unchanged. |
| T1.7 | `npx vitest run tests/demo` (RED, before impl) | 1 | suite failed to load: `@/demo/demo-fixtures` absent (expected); 0 tests ran. |
| T1.7 | `npx vitest run tests/demo` (GREEN) | 0 | 1 file, 12 tests passed (3 demos + solved: strict parse, bind ok, provenance only on wrapper; unknown/malformed rejected REQUEST_INVALID; scrambles equal legacy literal; invalid-state error shape; scan conditions). |
| T1.7 | `npm run test` | 0 | 16 files passed, 391 tests passed, 0 failed (architecture guard green with demo/). |
| T1.7 | `npm run lint` (`tsc --noEmit`) | 0 | no errors (after typing test request helper). |
| T1.7 | `npm run build` | 0 | built; existing chunk-size warning unchanged. |
| T1.8a | `npx vitest run tests/stores tests/hooks tests/services` (RED, before impl) | 1 | stores/hooks suites failed to load (`@/stores/*`, `@/hooks/*` absent, expected); R15 tests failed (health `cache: 'no-store'`, `status !== 'ok'` readiness, solver 404/502 BACKEND_UNAVAILABLE). |
| T1.8a | `npx vitest run` (GREEN) | 0 | 20 files passed, 423 tests passed, 0 failed (stores, runSolve incl. stale/session/mismatch/no-live-fallback, checkHealth, jsdom renderHook smoke, R15 service tests, architecture guard). |
| T1.8a | `npm run lint` (`tsc --noEmit`) | 0 | no errors. |
| T1.8a | `npm run build` | 0 | built; existing chunk-size warning unchanged. |
| T1.9 | `npx vitest run tests/engine/playback-fsm.test.ts` (RED, before impl) | 1 | suite failed to load: `Cannot find package '@/engine/playback-fsm'` (expected); 0 tests ran. |
| T1.9 | `npx vitest run tests/engine/playback-fsm.test.ts` (GREEN) | 0 | 1 file, 57 tests passed (B1, B2, associativity 240 seeded cases, 7500-step invariant property, pause/resume, replay, SET_DELAY, empty/1-move, immutability, event-set exhaustiveness). |
| T1.9 | `npm run test` | 0 | 22 files passed, 500 tests passed, 0 failed. |
| T1.9 | `npm run lint` (`tsc --noEmit`) | 0 | no errors. |
| T1.9 | `npm run build` | 0 | built; existing chunk-size warning unchanged. |
| T1.9-R21 | `npx vitest run tests/engine/playback-fsm.test.ts` (RED) | 1 | 4 failed / 63 passed (L5 x2, L6, L1); M1 fractional tests passed pre-fix (no failure reproduced). |
| T1.9-R21 | same (GREEN) / `npm run test` / lint / build | 0 | 67 passed; full 22 files, 510 tests; lint and build exit 0. |
| T1.10 | `npx vitest run tests/hooks/usePlayback.test.tsx` (RED, before impl) | 1 | suite failed to load: Vite import-resolution error for `@/hooks/usePlayback` (expected, module absent); 0 tests ran. |
| T1.10 | same (GREEN) | 0 | 1 file, 17 tests passed (clock, stall truncation, hidden/visible/resume, unmount, restart+stale frames, StrictMode single loop, progressRef/displayedIndex, 30 Hz publish, moves change, empty moves, audio cues). |
| T1.10 | `npm run test` | 0 | 23 files passed, 527 tests passed, 0 failed. |
| T1.10 | `npm run lint` (`tsc --noEmit`) | 0 | no errors. |
| T1.10 | `npm run build` | 0 | built; existing chunk-size warning unchanged. |
| T1.10-R1 | `npx vitest run tests/hooks/usePlayback.test.tsx` (RED) | 1 | 7 failed / 15 passed (content reset, Activity re-arm, frameRef x4, setDelay removal). |
| T1.10-R1 | same (GREEN) / `npm run test` / lint / build | 0 | 22 passed; full 23 files, 532 tests; lint and build exit 0. |
| T1.11 | `npx vitest run tests/components/three/animation.test.ts` (RED, before impl) | 1 | suite failed to load (module `@/components/three/animation` absent, expected); 0 tests ran. |
| T1.11 | same (GREEN) | 0 | 1 file, 21 tests passed (ease endpoints/legacy values/symmetry/monotonic, pivot per axis and sign, R and U' at 0.5, selectShown idle/animating/waiting/complete/paused/clamp/empty). |
| T1.11 | `npm run lint` / `npm run build` | 0 / 0 | tsc clean; built, existing chunk-size warning unchanged. |
| T1.11 | `npm run test` | 1 | 552 passed / 1 failed: `playback-fsm` seeded-invariant property test hit the 5000 ms timeout (10-13 s on this loaded machine; identical failure with my changes stashed; passes in isolation, 67/67). Not caused by T1.11. |
| T1.11 | Browser (Chrome, vite 127.0.0.1:3000, 1440x900), legacy path | n/a | Landing, Reconstruction and Alignment cubes render and respond to drag; Solving via demo animates (arrow, mid-turn R2 layer captured, Step 1 to 4 advanced). Console: only favicon.ico 404 and THREE.Clock deprecation warnings. Controlled mode NOT RUN in browser (no consumer until T1.12). |
| T1.12 | `npx vitest run tests/components` (RED, before impl) | 1 | animation.test: 19 failed (`reconcile` absent, highlight fields missing); SolvingScreen.test: 15 failed on the legacy screen (Prev/Next present, no frameRef/testids/cue/guidance). |
| T1.12 | `npm run test` (GREEN) | 0 | 25 files, 588 tests passed, 0 failed (animation 35, SolvingScreen 20, stores +1). |
| T1.12 | `npm run lint` / `npm run build` | 0 / 0 | tsc clean; built, existing chunk-size warning unchanged. |
| T1.12 | Browser (Chrome via playwright-cli, vite 127.0.0.1:3000, 1440x900, Playwright fake clock paused + runFor) | n/a | PASS: demo flow to Solving; pause mid-D' freezes layer (cube-region diff only in arrow pulse area), resume continues; countdown frozen 5 s while paused; replay re-shows D' with Step 1 of 18; pace 2 s vs 15 s; cue visible after orbit to back and bottom; no Prev/Next; all 18 moves played and Completion reached; D (front-bottom row F to R) and U' (front-top row F to R) directions correct from pre/mid/post captures; console only favicon 404 + THREE.Clock deprecation. |
| T1.13 | `npx vitest run tests/components/AlignmentScreen.test.tsx tests/components/CompletionScreen.test.tsx` (RED, before impl) | 1 | Alignment 4 of 8 failed, Completion 13 of 14 failed on the legacy screens (Start enabled without ready, guidance not cleared, no empty/no-solution state, confetti on mount, no confirm gating, padded time). |
| T1.13 | same (GREEN) | 0 | 2 files, 22 tests passed. |
| T1.13 | `npm run test` / `npm run lint` / `npm run build` | 0 / 0 / 0 | 27 files, 610 tests passed; tsc clean; built, existing chunk-size warning unchanged. |
| T1.13 | Browser (Chrome via playwright-cli, vite 127.0.0.1:3000, 1440x900, Playwright fake clock) | n/a | PASS: demo to Alignment, labels Top White / Front Green / Right Red, 18 moves ready; Start leads to Solving; playback completes, Completion appears; no confetti canvas before confirm, one fixed canvas appears after confirm; Guidance Time 1:45 (not the 1:12 floor); pre/post confirm and demo copy as specified; Replay Solution returns to Alignment with Start shown and no autoplay; N1 was NOT demonstrated by this run: a single frame was judged by eye at one rotation phase (see T1.13-R24 rows for the measured outcome). NOT RUN in browser: empty-solution path (unit tests only), reduced-motion path (unit tests only). Console: favicon 404 and THREE.Clock warnings only. |
| T1.13-R24 | N1 Completion cube clearance, Chrome 1440x900, Playwright fake clock, 8 frames over 16 s (a full 360 degree turn at 0.42 rad/s), card 548x480, bounding box = pixels differing from a canvas-hidden reference of the same card (labels hidden in both) | n/a | Baseline camera 4.3,3.2,4.7: FAIL, bottom margin 3 px in 6 of 8 frames (clipped; min 3, others 12 and 30). Intermediate 5.8,4.3,6.3: min margin 52 px (not the final value). Final 5.16,3.84,5.64 (baseline vector x1.2): PASS, min margin 25 px, per-frame min 44/35/58/27/75/25/64/33; top 78-87, left 89-137, right 90-119. |
| T1.13-R24 | Alignment twin clearance, same method, 8 frames, canvas box 650x560 | n/a | Baseline camera 4.3,3.3,4.9: FAIL, bottom margin 3 px (clipped) in all frames. Fixed 5.16,3.96,5.88 (x1.2): PASS, margins top 96 / bottom 45 / left 116 / right 122. |
| T1.13-R24 | Browser a11y spot check | n/a | After My Cube Is Solved: document.activeElement is H1, role=status text "You confirmed all 54 stickers are solved after 18 moves."; console only favicon 404. |
| T1.13-R24 | `npx vitest run tests/components tests/stores tests/lib` (RED, before fix) | 1 | 11 failed: Alignment Finish left guidance, stale-button double confirm, unmount did not reset confetti, 0-move copy, status/focus, sr-only disclaimer, SolvingScreen finishEmpty guidance {0}, setGuidance NaN/Infinity/-Infinity/-1 accepted. |
| T1.13-R24 | same (GREEN) / `npm run test` / lint / build | 0 / 0 / 0 | 7 files 117 tests; full 28 files, 624 tests passed; tsc clean; built. |
| T1.14a | `npx vitest run tests/lib/contain-transform.test.ts tests/hooks/useCamera.test.tsx` (RED, stub hook, no contain-transform) | 1 | 2 files failed, 32 tests failed (missing module; stub throws 'todo'). |
| T1.14a | same (GREEN) / `npm run test` / lint / build | 0 / 0 / 0 / 0 | 2 files 47 tests; full 30 files, 671 tests passed; tsc clean; built. Fake streams only; no real camera; browser NOT RUN (not wired). |
| T1.14b | `npx vitest run tests/components/ScanningScreen.test.tsx` (RED, before impl, legacy screen) | 1 | 21 of 24 failed (no "Simulated feed", confidences 0.99.. present, real-webcam toggle present, no LiveUnavailablePanel, camera auto-requested paths, no scan-guide-panel); 3 passed. |
| T1.14b | same (GREEN) / `npm run test` / lint / build | 0 / 0 / 0 / 0 | 24 of 24; full 31 files, 710 tests passed; tsc clean; built (existing chunk-size warning). |
| T1.14b | Browser (Chrome via playwright-cli, vite 127.0.0.1:3000, 1440x900, DEMO only, no webcam) | n/a | PASS: Landing to Scan; "Simulated feed" tag; overlay labels G,Y,O,O,B,B,R,G,B (no numbers; body text regex for d.dd/98.2 = null); no <video>; six faces auto-captured then Reconstruction reached; picker states no_cube / missing / wrong face / unstable / permission denied each rendered and expected text present; Loading option shows "Starting demo feed" overlay (captured immediately via run-code). Visual diffs vs baseline 02-scanning-normal-desktop: Simulated feed tag added; box labels colour code only; Detection Confidence value "Simulated"; header "Simulated Camera" (was "Camera Active"); footer "Switch to Real Webcam" removed; "Demo: scripted stability" note in progress bar; layout otherwise identical. Console: favicon 404 only. LIVE browser checks: NOT RUN (no UI entry until T1.16; covered by component tests with fake streams). |
| T1.15 | `npx vitest run tests/features/review tests/components/ReconstructionScreen.test.tsx` (RED, before impl, legacy screen, no stages module) | 1 | 2 files failed; 19 failed, 3 passed (stages module missing; legacy screen had no real stages, filled faces, hard-coded counts and Parity text). |
| T1.15 | same (GREEN) / `npm run test` / lint / build | 0 / 0 / 0 / 0 | 2 files 46 tests; full 33 files, 770 tests passed; tsc clean; built (existing chunk-size warning). |
| T1.15 | Browser (Chrome via playwright-cli, vite 127.0.0.1:3000, 1440x900, DEMO only, no webcam) | n/a | PASS: Try Interactive Demo reaches Reconstruction; mid-stagger states passed,passed,active,pending x3 at ~0.9 s; all six passed after stagger with "Demo fixture" details, "Demo solution (pre-computed)", no "Kociemba" in page text; 2D Net/3D Twin toggle works; Test Invalid shows INVALID_CUBE_STATE message, stage 4 failed, 5/6 pending, Try again + Restart Full Scan, no per-face rescan, no "Parity check failed"; Restore Valid State returns to ready; Prepare to Solve reaches Alignment. Differences vs baseline 03-*: stage list is the six real stages (was 54 stickers detected ... Kociemba generated); "Captured Stickers" replaces "Detected Stickers"; "Demo Solution" label with small "demo, pre-computed" suffix; stage 5 label wraps to two lines (card ~12 px taller); right-hand detail text ("Demo fixture", "18 moves") replaces "OK" where present; invalid panel text/buttons per new contract. Live mode NOT RUN (no UI entry until T1.16; component tests only). Screenshots in shots/t115 (git-ignored). |
| T1.15-R28/R29 | `npx vitest run tests/features/review tests/components/ReconstructionScreen.test.tsx` (RED then GREEN) / `npm run test` / lint / build | 1 then 0 / 0 / 0 / 0 | RED 11 failed of 53; GREEN 53/53; full 33 files, 777 passed; tsc clean; built. Mutation (remove solveRequestGuard.reset) fails the in-flight test. Browser demo: net neutral on invalid, green only after stage 4. Live NOT RUN. |
| T1.15-R30 | `npx vitest run tests/features/review tests/components/ReconstructionScreen.test.tsx` (RED then GREEN) / `npm run test` / lint / build | 1 then 0 / 0 / 0 / 0 | RED 7 failed of 58; GREEN 58/58; full 33 files, 782 passed; tsc clean; built. No browser run (no intended visual change). |
| T1.16 | `npx vitest run tests/components/ModeBanner.test.tsx tests/components/LandingScreen.test.tsx tests/components/SolvingScreen.test.tsx` (RED, before impl) | 1 | 3 files failed, 4+ failed (ModeBanner module missing; Landing live/walk-through/confidence/caption assertions; Solving banner absent). |
| T1.16 | `npm run test` / lint / build (GREEN) | 0 / 0 / 0 | 35 files, 809 tests passed; tsc clean; built (existing chunk-size warning). |
| T1.16 | Browser (Chrome via playwright-cli, vite 127.0.0.1:3000, 1440x900, Chrome fake media flags) | n/a | PASS: Demo to Reconstruction, Alignment, Solving: banner (28 px, exact text) on each; Solving dock buttons y 829-867 of 900, no overflow. Walk-through shows Scanning with banner; Scan My Cube shows live, no banner, "Vision service is not running" panel. Camera (fake only): enumerateDevices video inputs = [fake_device_0]; Enable camera gave video readyState 4, 1280 wide, transform none, object-contain; leaving via brand and via Restart Scan ended all tracks (readyState ended), srcObject null, video detached. Landing vs baseline: new caption row under CTAs (+~36 px page height), hero cube is the demo scramble (was legacy), hero caption "Illustration — simulated detection", detection labels without numbers. Screenshots in shots/t116 (git-ignored). |
| T1.17A | `npx vitest run tests/stores/demo-session.test.ts` with session-store `demoSeed`/`advanceDemoSeed` stashed (RED) | 1 | 2 failed / 8 passed (`advanceDemoSeed is not a function`; seed-survival assertions). |
| T1.17A | `npx vitest run tests/components/LandingScreen.test.tsx` (RED, copy test before copy change) | 1 | 2 failed: unmeasured-claims test matched `consensus`; CTA reset test over-asserted pre-state (test fixed, not code). |
| T1.17A | `npm run lint` / `npm run test` / `npm run build` (GREEN, nothing deleted) | 0 / 0 / 0 | tsc clean; 38 files, 840 tests passed; built (existing chunk-size warning). No src file imports `@/store/useRubikStore` or `@/lib/cubeEngine` except the bridge/engine themselves and the type-only/legacy-equality tests. |
| T1.17B | `npx vitest run tests/architecture` (RED, guard added before deletion) | 1 | 1 failed / 8 passed: real-tree legacy guard listed exactly the 6 expected offenders (store/useRubikStore.ts, legacy-characterization/legacy-golden/bridge/colors tests). |
| T1.17B | `git grep -n "cubeEngine\|useRubikStore" -- frontend/src frontend/tests` | 0 | Only: a comment in engine/move-presentation.ts, the guard's own pattern strings in tests/architecture/boundaries.test.ts, and `source` provenance strings inside tests/golden/*.json. No import. |
| T1.17B | `npm run lint` / `npm run test` / `npm run build` (GREEN, legacy deleted) | 0 / 0 / 0 | tsc clean; 36 files, 735 tests passed (840 minus deleted legacy differential/bridge tests plus guard and move-presentation tests); built, no unused-export errors. COLOR_META == legacy STICKER_COLORS equality passed in commit A's suite (tests/lib/colors.test.ts), literal-table test remains. |
| T1.17B | Browser (Chrome via playwright-cli, vite 127.0.0.1:3000, 1440x900, NO camera step; screenshots in .superpowers/sdd/.../shots/t117) | n/a | PASS: Landing, Try Interactive Demo, Reconstruction (DEMO label, 6/6 checks), Alignment, Solving (Step 3 of 18, so 2+ moves played, dock fully visible y 815-880), Playwright clock runFor, Completion (DEMO GUIDANCE COMPLETE). Landing, Walk through the simulated scan, six auto-captures, Reconstruction reached. Console: only favicon.ico 404 and THREE.Clock deprecation warning (both pre-existing). Vite killed by PID, browser closed. |
| T1.18 | `git grep -n -E "from '(@google/genai\|dotenv\|express\|motion\|tsx\|autoprefixer\|three-stdlib)" -- src tests index.html vite.config.ts vitest.config.ts` | 1 (no match) | No import of any candidate or of three-stdlib; no postcss config. Only false hits: `prefers-reduced-motion`, `.tsx` file names, "re-expresses" in a provenance doc. |
| T1.18 | `npx vitest run tests/config` (RED, before any change) | 1 | 8 failed / 8 (name, removed deps, dev host, clean script, vite server/proxy/plugin, favicon, README, .env.example). |
| T1.18 | `npm install` then `npm ci` from deleted node_modules | 0 / 0 | Removed 7 declared packages (`@google/genai`, `dotenv`, `express`, `motion`, `@types/express`, `autoprefixer`, `tsx`); lockfile 403 to 244 entries (159 removed, 0 added, 0 version changes); 0 extraneous in `npm ls --depth=0`; 0 vulnerabilities. |
| T1.18 | `npm run lint` / `npm run build` / `npm run clean` (twice) | 0 / 0 / 0 | tsc clean; built with hashed `dist/assets/webcam_cube_hands_*.jpg`, no `dist/src`, no `/src/assets` reference; only the existing chunk-size warning; clean works with and without dist. |
| T1.18 | `npm run test` (PowerShell) | 0 | 37 files, 760 tests passed. |
| T1.18 | `npm run dev`; netstat; curl | n/a | Listens only on 127.0.0.1:5173; `/` 200, `/favicon.svg` 200; `/health` and `/api/solve` 502 (proxy active, no backend). Killed by PID; port closed (curl 000, no LISTENING). |
| T1.18 | Browser (Chrome via playwright-cli, 127.0.0.1:5173, 1440x900, NO camera step; shots/t118) | n/a | PASS: Landing, demo to Reconstruction, Alignment, Solving (Step 2 of 18, DEMO note). Console: 0 errors, only the known THREE.Clock warning; no favicon 404. Browser closed. |

## Notes

- Goldens in `frontend/tests/golden/legacy-characterization.json` are characterization of the legacy engine at `e0105ca`, not ground truth.
- Browser/WebGL checks: NOT RUN in T1.2.

---

## Appendix B: ruling log

Controller rulings from the ledger `.superpowers/sdd/2026-11-19-frontend-refactor/progress.md` (R34 is from the T1.15 report), one line each.

| # | Ruling |
|---|---|
| R1 | T1.4a uses a permissive (MIT) cubie reference, `ldez/cubejs` pinned by commit SHA; only numeric tables vendored; stop if none reachable |
| R2 | T1.11 keeps the legacy self-driven animation only when `moveProgress` is absent; T1.12 removes it |
| R3 | `usePlayback` owns a playback-run generation, separate from the session id |
| R4 | Compat facade exposes only what current screens read (superseded by R17) |
| R5 | Mobile-only defects (N1 mobile part, N2, N7) deferred |
| R6 | Favicon if trivial; no three.js upgrade |
| R7 | T1.19 browser captures stay under ignored `.superpowers/`; commit at most 3 key images only if useful |
| R8 | T1.20 includes the desktop-first note in ARCHITECTURE v1.1; CLAUDE.md commands updated and listed in the final report |
| R9 | Behavioural tasks get two fresh reviewers (spec, then quality); mechanical or docs tasks get one combined reviewer |
| R10 | T1.2 (tooling and characterization) treated like a mechanical task: one combined reviewer |
| R11 | T1.4b minors (prototype keys, `verifySolution` throwing) folded into T1.4c scope |
| R12 | T1.4c creates `types/api.ts` with only the solve wire types; T1.6 extends it |
| R13 | Colour words for known centres are allowed in scan guidance; unobserved centres' colours are forbidden |
| R14 | yolo mode with vision ready but solver not ready is blocked (`BACKEND_UNAVAILABLE`), fail closed |
| R15 | Readiness must require `status === 'ok'`; 404/502 from the proxy map to `BACKEND_UNAVAILABLE`; health uses `no-store` |
| R16 | One `ScanCondition` type (`DemoScanCondition | 'captured_flash'`) in the scan store |
| R17 | T1.8 split into T1.8a (stores, hooks) and T1.8b (one-way legacy bridge) |
| R18 | One module-level `solve-guard`; `startSession` resets it first; `runSolve` fails closed on exceptions; health clears readiness on re-check |
| R19 | Accept `markFaceNeedsRescan` and rescan invalidating the guard and cube store |
| R20 | `toCubies` must emit the stickerless core cubie (27 total) to avoid a visual regression |
| R21 | T1.9 hardening round: exact phase boundaries under fractional dt, hidden-pause safety, pause-reason upgrade, integer generations, renderer-contract comment |
| R22 | `usePlayback`: moves keyed by content, mount effect re-arms the loop, renderer reads only `frameRef`, single delay source (`delayMs`) |
| R23 | Playback property test too slow: profile and cut cost (not just a longer timeout), keep coverage, suite green 3 times |
| R24 | T1.13 fix round: N1 clipping, vacuous tests, 0-move consistency, a11y, finite guard, confetti reset, duration tests |
| R25 | T1.14 split into T1.14a (`contain-transform`, `useCamera`) and T1.14b (scanner split and wiring) |
| R26 | `useCamera.start()` always stops any active stream first; fulfilment handler wrapped so a failure cannot leave a stream running |
| R27 | T1.14b fix round: a11y, split viewports, isolate stability re-renders, gate on `mode === 'live'`, capture once, health re-check on restart |
| R28 | Net "validated" styling derives from stage 4; neutral when any stage failed |
| R29 | Stage 4 passes only when status is ready or the error is a replay mismatch; response mismatch fails stage 4 |
| R30 | Gate Test Invalid and `rerunSolve` on structural validity; interrupted validation is terminal with Try again |
| R31 | `runSolve` validates the request structurally before any solver or network call (REQUEST_INVALID, zero calls) |
| R32 | T1.16 fix round: hero caption relabelled as an illustration, Alignment CTA in view, calmer banner role, reset tests |
| R33 | T1.17 fix round: one mode-aware `restartScan`, neutral Landing model wording, stores-layer guard, stronger regex tests |
| R34 | Reconstruction 2D Net shows a finished-state heading once all stages pass (`56aae9e`); RED then GREEN recorded, no browser run |

Also recorded in the ledger: user rule of 2026-11-22 (Sonnet 5.5 only, no Opus escalation), pre-flight scan, and carry-forward items between tasks.
