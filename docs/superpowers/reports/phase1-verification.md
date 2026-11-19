# Phase 1 verification log

Branch `refactor/phase-1-frontend`. All commands run from `frontend/` unless noted. Results are copied from actual command output.

## Running log

| Task | Command | Exit | Result |
|---|---|---|---|
| T1.2 | `npm install -D vitest@5.1.1 jsdom@31.0.1 @testing-library/react@16.3.3 @testing-library/dom@10.4.2 @testing-library/jest-dom@8.0.0 @testing-library/user-event@14.6.13` | 0 | added 67 packages, 0 vulnerabilities. Peer ranges checked first with `npm view`: vitest 5.1.1 accepts vite ^6.4 / ^7 / ^8 (installed 8.3.8) and @types/node ^22. |
| T1.2 | `npm run test` | 0 | 3 test files passed, 114 tests passed, 0 failed (legacy engine characterization incl. 75 invariance checks, legacy goldens, architecture guard). |
| T1.2 | `npm run lint` (`tsc --noEmit`, `strict: true`) | 0 | no errors. |
| T1.2 | `npm run build` (`vite build`) | 0 | built in 721ms; existing chunk-size warning (>500 kB) unchanged. |

## Notes

- Goldens in `frontend/tests/golden/legacy-characterization.json` are characterization of the legacy engine at `e0105ca`, not ground truth.
- Browser/WebGL checks: NOT RUN in T1.2.
