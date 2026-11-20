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

## Notes

- Goldens in `frontend/tests/golden/legacy-characterization.json` are characterization of the legacy engine at `e0105ca`, not ground truth.
- Browser/WebGL checks: NOT RUN in T1.2.
