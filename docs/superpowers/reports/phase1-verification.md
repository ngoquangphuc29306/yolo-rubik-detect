# Phase 1 verification log

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
| T1.13 | Browser (Chrome via playwright-cli, vite 127.0.0.1:3000, 1440x900, Playwright fake clock) | n/a | PASS: demo to Alignment, labels Top White / Front Green / Right Red, 18 moves ready; Start leads to Solving; playback completes, Completion appears; no confetti canvas before confirm, one fixed canvas appears after confirm; Guidance Time 1:45 (not the 1:12 floor); pre/post confirm and demo copy as specified; Replay Solution returns to Alignment with Start shown and no autoplay; cube fully visible after camera 4.3,3.2,4.7 to 5.8,4.3,6.3 (N1). NOT RUN in browser: empty-solution path (unit tests only), reduced-motion path (unit tests only). Console: favicon 404 and THREE.Clock warnings only. |

## Notes

- Goldens in `frontend/tests/golden/legacy-characterization.json` are characterization of the legacy engine at `e0105ca`, not ground truth.
- Browser/WebGL checks: NOT RUN in T1.2.
