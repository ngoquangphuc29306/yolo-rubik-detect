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

## Notes

- Goldens in `frontend/tests/golden/legacy-characterization.json` are characterization of the legacy engine at `e0105ca`, not ground truth.
- Browser/WebGL checks: NOT RUN in T1.2.
