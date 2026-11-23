# Phase 2 verification report (backend)

| Field | Value |
| --- | --- |
| Date | 2026-11-23 |
| Branch | `feat/phase-2-backend` (from `main` `cae4df6`) |
| Design | `docs/superpowers/specs/2026-11-22-phase-2-backend-design.md` (approved 2026-11-23, Q1 to Q5 and section 13 corrections) |
| Plan | `docs/superpowers/plans/2026-11-22-phase-2-backend.md` |
| Status | Implemented; awaiting the user's approval. Final gate (Task 11) not yet run. |

Nothing in this report was verified against a physical cube. A passing solve means the library's move list replays to solved in two independent engines, not that a real cube was scanned correctly.

## 1. Summary

Legend: PASS, FAIL, NOT RUN, BLOCKED. Evidence is the recorded output of a command run in this phase.

### 1.1 Per task

| Task | Deliverable | Result | Evidence |
| --- | --- | --- | --- |
| 1 | uv project scaffold, canonical facelet construction | PASS | Commit `3260cd5`; `uv run pytest` 10 passed; ruff and mypy clean |
| 2 | Geometry table and 18-move engine | PASS | Commit `a6b728a`; 43 passed (controller re-run 43 passed), including superflip and four hand-derived goldens |
| 3 | TypeScript-generated engine fixtures and Python equality | PASS | Commit `55ebf44`; frontend 763 tests, backend 85 passed; crosscheck vitest 2 of 2 |
| 4 | Cubie legality validation | PASS | Commit `6039694`; 95 passed; controller probe: 600 legal states accepted, twist, flip, parity and scramble-flip mutants rejected |
| 5 | `cube-solver` adapter and explicit table preparation | PASS | Commit `79ad2c1`; 103 passed in 3.3 s; tables built in 282.8 s (`pruning_kociemba.npz` 1634.2 MB, `transition.npz` 2.0 MB), git-ignored |
| 6 | Solve service and `POST /api/solve` with strict contracts | PASS | Commit `a77c9c1`; 148 passed; controller probe: `schemaVersion` true, false, 1.0, "1", 2 all 422 `INVALID_FACE_SHAPE`, 1 gives 200 |
| 7 | `GET /health` | PASS | Commit `c7c762e`; 151 passed; exact body confirmed by the controller |
| 8 | Cross-check fixtures, recorder, 300-state slow test, frontend binder and live block | PASS | Commit `e60bbf7`; backend 153 passed plus slow 300 of 300 (p50 0.039 s, p95 0.232 s, max 0.561 s); frontend 806 passed, 4 skipped; live block against uvicorn directly 47 passed, 0 skipped |
| 9 | Live smoke through the Vite proxy and browser pass | PASS | No commit; `t9/t9-findings.md` 9 PASS, 0 FAIL; controller read the findings and `02-scan-live.png` |
| 10 | Documentation and this report | DONE — reviewed (docs review approved; two wording fixes applied in this commit) | README, CLAUDE.md, `docs/ARCHITECTURE.md` v1.2, this report |
| 11 | Final gate | NOT RUN | Section 8 |

### 1.2 Per acceptance area

| Area | Result | Evidence |
| --- | --- | --- |
| Contract (`/health` and `/api/solve` bodies, envelope, status map) | PASS | `tests/api` suites; fixtures `solved` and `scramble-a` compared; error fixtures `duplicate-center` and `invalid-cube-state` equal exactly; 422 and 503 statuses per ARCHITECTURE section 8.3. The `/health` body equals the Phase 2 body (status `degraded`, `detectorMode` `yolo`, `visionReady` false, `solverReady` true). |
| Validation (shape, centres, counts, legality) | PASS | `tests/cube` and `tests/api`: every structural path and each legality check (identity, twist, flip, parity) has its own mutant test; controller probes recorded in Tasks 4 and 6 |
| Solver (adapter, service, timeout, faults) | PASS | `tests/solver`: real solver through a session fixture that fails, never skips, without tables; timeout path, `None` without termination and bad replay are faults, never a 200 |
| Cross-checks (Python, TypeScript, library) | PASS | 40 seeded 25-move sequences plus 18 single moves from the TypeScript engine compared after every move; 42 backend-recorded solve responses bound by `parseSolveResponse` and `bindSolveResponse`; 300 seeded states solved and replayed (slow test, 300 of 300) |
| Live client integration (unmodified `getHealth()` and `solve()` via the Vite proxy) | PASS | Live block: 4 live tests ran and passed; file 47 passed, 0 skipped (Task 9); also 47 passed, 0 skipped against uvicorn directly (Task 8). `scramble-a` through the proxy: 200, 21 moves, replay true. Duplicate centre: 422 `DUPLICATE_CENTER`. |
| Browser (1440x900) | PASS | Live scan screen reads "Vision model is not available — the solver is still usable"; no demo banner; Capture Face disabled; camera never enabled; demo flow reaches the Solving screen (step 2 of 18, DEMO banner); console 0 errors, 4 `THREE.Clock` deprecation warnings (expected, known) |
| Physical cube | NOT RUN | No physical cube and no webcam were used in Phase 2 |
| Vision, `/ws/scan`, weights | NOT RUN | Out of scope for Phase 2 |

## 2. Counts recorded for Task 10 (commands re-run on 2026-11-23)

| Command | Result |
| --- | --- |
| `uv run pytest` (backend) | exit 0, 153 passed, 1 deselected (the slow test), 4.18 s |
| `uv run pytest -m slow` (backend) | exit 0, 1 passed, 153 deselected, 22.71 s |
| `uv run ruff check .` | All checks passed |
| `uv run mypy app` | Success: no issues found in 19 source files |
| `uv sync` | Resolved 37 packages, checked 36 packages (nothing to change) |
| `npm run test` (frontend, PowerShell) | exit 0, 39 files passed, 806 tests passed, 4 skipped (the live block, skipped without `RUBIK_LIVE_BASE_URL`) |
| `npm run lint` (frontend) | exit 0 (`tsc --noEmit`) |

## 3. Solver benchmark summary (design section 4)

Throwaway benchmark on 2026-11-22, in isolated Python 3.12.13 environments (Intel i3-9100F, 19.9 GB RAM, Windows 11). States came from the repo's TypeScript engine; every returned move list was replayed with the TypeScript `verifySolution`. 48 states (solved, 6 named patterns, `scramble-a`, 40 seeded scrambles) plus a separate 300-state stress set.

| | `kociemba` 1.2.1 | `RubikTwoPhase` 1.1.1 | `cube-solver` 1.1.4 | `rubik-solver-py` 0.1.1 |
| --- | --- | --- | --- | --- |
| Licence | GPL-2.0 | GPL-3.0 | MIT | MIT |
| Installs on this machine | No (needs MSVC Build Tools) | Yes | Yes | Yes |
| 300 stress states replay to solved | not run | NOT RUN | 300/300 | 300/300 |
| Latency median / p95 / max | n/a (48-state run: 949 ms / 7.2 s / 85.1 s, inflated by an overlapping job) | NOT RUN | 75 / 436 / 1271 ms | 508 / 2992 / 10696 ms |
| Rejects the 5 illegal states | 5/5 (pure-Python fallback) | NOT RUN | 5/5 | 0/5 |
| Timeout control | n/a | built-in | built-in, cooperative | none |
| Resident memory | 82 MB (fallback) | NOT RUN | 1591 MB | 35 MB |
| First table build | n/a | more than 24 min, not finished | 386.6 s (1.63 GB) | 21.7 s |

`RubikTwoPhase` was not completed (its table build was still running when the design was finalised and the licence already excluded it). Selected: `cube-solver` 1.1.4 (MIT), behind a `Solver` protocol, with the backend's own validation and replay.

Measured in the implementation phase (not the benchmark): table build 282.8 s; `pruning_kociemba.npz` 1634.2 MB and `transition.npz` 2.0 MB; server startup 4.17 s; serving process RSS 1616 MB; the 300-state slow check p50 0.039 s, p95 0.232 s, max 0.561 s (20 to 30 random moves each, solved and replayed in Python).

## 4. Review record

- Code tasks 1, 2, 4, 5, 6, 7 and 8 each had two independent reviewers (spec compliance and code quality, Sonnet). All reviews were clean: spec compliant and Approved, with minor findings only (minor findings parked, see §4.1).
- Task 3 is test-only: one combined spec and quality reviewer (ruling below). Spec compliant, Approved.
- Task 9 has no diff: its gate was controller verification of `t9-findings.md`, the screenshots, closed ports 8000 and 5173 and a clean `git status`.
- Task 10 is documentation only; the final whole-branch review and gate are Task 11.

### 4.1 Parked minor findings (from the ledger)

| Task | Finding |
| --- | --- |
| 2 | `apply_move` has no length check; `MappingProxyType` and extra goldens suggested |
| 3 | Python-side length assertions |
| 4 | Minor items noted; centres are not checked inside `check_legal`, resolved because `build_facelet_state` fixes each centre by construction |
| 5 | `catch_warnings` in `solve` is not thread-safe; the concurrency test cannot detect a missing lock; no `solve(SOLVED)` adapter test; `load()` changes the working directory (startup only); double fail message; `prepare` duplicates an import helper; no unknown-token test |
| 6 | Cancellation releases the asyncio lock while the thread runs (mitigated: the adapter holds its own threading lock and passes the library timeout) |
| 7 | Hard-coded readiness flags (fine for Phase 2); local imports in a test |
| 8 | `CENTERS` dict duplicated; the recorder uses `assert`; the slow test prints timings only; `faces_from_state` raises `KeyError` on a bad character |

## 5. Rulings

- **P1.** `[tool.pytest.ini_options] pythonpath = ["."]`; `backend/` stays un-installed (no build backend).
- **P2.** The `CORNER_IDENTITY` test may use any 54-character string with nine of each letter, fixed centres, and one corner slot with an impossible letter set (two opposite faces).
- **P3.** mypy override `ignore_missing_imports` for `cube_solver`; all `app` code stays strictly typed.
- **P4.** Recorder and tests locate repo-root fixtures with `Path(__file__).resolve().parents[N]` (conftest `REPO_ROOT`), never the working directory.
- Test-only tasks get one combined spec and quality reviewer (as in Phase 1).
- `ruff format --check` is not a plan-required check (the plan requires `ruff check`); no reformat churn.
- Non-fixture wire messages (`COLOR_COUNT_MISMATCH`, `INVALID_FACE_SHAPE`, `SOLVER_TIMEOUT`) were worded by the controller; the spec leaves the wording to the builder.
- The Task 8 implementer also ran the live block once against uvicorn directly to prove it executes; Task 9 ran it through the Vite proxy.
- Task 9 has no diff, so its gate is controller verification of the evidence files and screenshots.
- Subagent models: implementers and reviewers ran on Sonnet by user instruction, including the final whole-branch review.
- Execution stayed on branch `feat/phase-2-backend` in the main working tree; `.claude/` and `skills-lock.json` (untracked user files) were never staged.

## 6. Known limitations

- **Orientation risk (R1).** The solve request carries no evidence of face roll. A face scanned rotated, or U/D captured in the wrong tilt, changes the facelet string. Most such errors are illegal (422), but a legal wrong state is possible. The backend never rotates or repairs a cube. Legality is not correctness.
- **No physical cube.** Nothing was verified on a real cube. All three oracles (TypeScript-engine fixtures, published solved and superflip strings, library solutions replayed in both engines) share the published Kociemba facelet convention; a shared conceptual error is still possible.
- **Vision is absent.** No `/ws/scan`, detector or weights. `/health` reports `visionReady: false`, so Live scanning stays blocked by design.
- **Resources.** The solver needs about 1.6 GB of RAM while serving and 1.6 GB of disk, plus a one-time table build of about 5–7 minutes (282.8 s Task 5 build, 386.6 s design benchmark first build). Re-check when YOLO is loaded (Phase 6).
- **Wire gaps.** No wire code exists for internal faults or "solver not ready": a bare 500 maps to the client's `BACKEND_UNAVAILABLE`. A missing table cache means the process does not start.
- **Live footer copy (observation, not a defect, Phase 1 copy, out of scope).** On the live screen with the backend connected but vision unavailable, the footer reads "Capture unavailable — no vision connection".
- **Formatting.** `ruff format` is not enforced; only `ruff check` is a gate.
- **Concurrency.** Client disconnects are not detected; a superseded solve finishes and its result is discarded by the client request guard. Accepted at this scale.
- **Model naming.** The user reports a separately trained YOLO26s model for Phase 6, while ARCHITECTURE still names YOLO26n. Recorded in ARCHITECTURE risk R8; vision scope is unchanged.
- **Console.** The known `THREE.Clock` deprecation warning remains (4 in the Task 9 browser pass).

## 7. Reproduce

```bash
cd backend
uv sync
uv run python -m app.solver.prepare          # once; about 5–7 min, 1.6 GB
uv run pytest
uv run pytest -m slow
uv run ruff check .
uv run mypy app
uv run uvicorn --factory app.main:create_app --host 127.0.0.1 --port 8000
```

Live client check (backend and `npm run dev` running, from `frontend/`): set `RUBIK_LIVE_BASE_URL` to `http://127.0.0.1:5173` and run `npx vitest run tests/crosscheck/backend-solutions.test.ts`.

## 8. Final gate (Task 11)

NOT RUN. Task 11 fills this section: full backend and frontend suites, the slow check, live client integration, port cleanup and the whole-branch review.
