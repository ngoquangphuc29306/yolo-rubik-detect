# RubikVision

RubikVision helps you solve a physical 3x3 Rubik's Cube. The intended flow is a guided webcam scan, YOLO facelet detection, cube reconstruction with a Kociemba solution, and a Three.js digital twin that walks you through the moves on a timer.

## Status

The project is being built model-last.

- **Frontend (`frontend/`)**: React app with the six-screen flow (Landing, Scanning, Reconstruction, Alignment, Solving, Completion). It is complete in **demo** mode.
- **Backend (`backend/`)**: a FastAPI service with `GET /health` and `POST /api/solve` (cube validation and a real two-phase solver). It is implemented on branch `feat/phase-2-backend` and awaits approval. There is no `/ws/scan` endpoint, no detector and no trained YOLO weights, so the backend reports vision as unavailable and Live scanning stays blocked.
- Nothing here has been verified against a physical cube.

## Requirements

- Node.js 22 or newer
- npm (the committed `package-lock.json` is the only lockfile)

## Run the frontend

All commands run from `frontend/`.

```bash
cd frontend
npm ci              # install from the lockfile
npm run dev         # http://127.0.0.1:5173 (loopback only)
npm run test        # Vitest, single run
npm run lint        # TypeScript check (tsc --noEmit)
npm run build       # production build into frontend/dist
npm run preview     # serve the build on http://127.0.0.1:4173
npm run clean       # remove frontend/dist
```

Run a single test file with `npx vitest run <path>`, for example `npx vitest run tests/engine`.

On Windows, if Vitest fails with a drive-letter error such as `reading 'config'`, run it from PowerShell in a path whose drive-letter case matches the working directory.

The dev server only listens on `127.0.0.1`. It proxies `/api`, `/health` and `/ws` (WebSocket) to `127.0.0.1:8000`, where the backend runs. No environment variables are required.

## Backend

The backend lives in `backend/` (Python 3.12, FastAPI, managed with [uv](https://docs.astral.sh/uv/)). It serves `GET /health` and `POST /api/solve` on loopback only. All commands run from `backend/`.

```bash
cd backend
uv sync                                   # install from uv.lock
uv run python -m app.solver.prepare       # one-time solver table build (see warning)
uv run uvicorn --factory app.main:create_app --host 127.0.0.1 --port 8000
```

**One-time table build.** The solver (`cube-solver` 1.1.4, MIT) needs lookup tables that are not committed. `app.solver.prepare` builds them into `backend/.solver-cache/tables/` (git-ignored). Expect about 5–7 minutes (282.8 s for the Task 5 build, 386.6 s for the design benchmark's first build, both on the development machine), about 1.6 GB of disk and about 1.6 GB of RAM while it runs. The server does not build tables itself: without them it refuses to start and prints this command. While serving, the process uses about 1.6 GB of RAM.

`uvicorn --factory app.main:create_app` is the only supported start form; there is no module-level `app` object. There is no CORS middleware: the browser reaches the backend through the Vite dev proxy (same origin).

The WebSocket library (`websockets`) is part of the locked dependencies installed by `uv sync`; no extra flags are needed for the server to serve `/ws/scan`.

```bash
uv run pytest             # 153 tests, excludes the slow cross-check
uv run pytest -m slow     # 300 real solves replayed in Python (about 23 s)
uv run ruff check .
uv run mypy app
```

The tests need the solver tables. If they are missing, the solver fixtures fail (they never skip) and print the prepare command.

Environment variables (read once at startup):

| Variable | Default | Meaning |
| --- | --- | --- |
| `RUBIK_DETECTOR_MODE` | `yolo` | Only `yolo` is accepted in Phase 2. `/health` reports `visionReady: false` because no model exists. |
| `RUBIK_SOLVER_CACHE_DIR` | `backend/.solver-cache/` | Parent directory of `tables/`. |
| `RUBIK_SOLVER_TIMEOUT_S` | `10` | Solver time limit in whole seconds. A timeout returns 503 `SOLVER_TIMEOUT`. |

### Check the frontend clients against the live backend

With the backend and the Vite dev server (`npm run dev`) both running, the committed live test block drives the unmodified frontend `getHealth()` and `solve()` through the proxy. From `frontend/` in PowerShell:

```powershell
$env:RUBIK_LIVE_BASE_URL = 'http://127.0.0.1:5173'
npx vitest run tests/crosscheck/backend-solutions.test.ts
Remove-Item Env:RUBIK_LIVE_BASE_URL
```

Without the variable that block is skipped (4 tests). A passing solve means the server's solution replays to solved in two engines; it does not mean a real cube was scanned correctly.

## Demo and Live

- **Demo** is simulated. The scan, detections and solution come from deterministic fixtures, and every demo workflow screen carries a visible "Demo" label (the Landing hero is a labelled illustration). A finished demo only means the instructions ended. It says nothing about a real cube.
- **Live** needs the backend and the trained model. The backend exists but the model does not, so Live is blocked and says "Vision model is not available — the solver is still usable". It never falls back to fixtures silently.
- The camera is used only after you press "Enable camera". Video frames stay in the browser: they are not stored and not sent anywhere.

## Privacy

- No webcam frames are stored or transmitted.
- The page loads its fonts from Google Fonts, which is a third-party request made by your browser. Self-hosting the fonts is a planned follow-up.

## Project layout

```
frontend/
  src/engine/      pure cube state, facelet geometry, moves and playback reducer
  src/demo/        explicit deterministic demo fixtures
  src/features/    product workflows (landing, scanner, review, align, solver)
  src/components/  shared UI and the Three.js renderer
  src/hooks/       browser lifecycle and orchestration
  src/stores/      session state (Zustand)
  src/services/    typed, validated transport boundaries
  tests/           Vitest suites
fixtures/          shared JSON fixtures for the API contracts
backend/
  app/api/         /health and /api/solve routes
  app/cube/        pure facelet state, geometry, moves and legality
  app/solver/      solver adapter, service and the table prepare command
  tests/           pytest suites (cube, solver, api, crosscheck)
docs/              architecture, plans and phase reports
```

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): product behaviour, geometry, API contracts and release criteria
- [docs/superpowers/](docs/superpowers/): implementation plans and verified phase reports

## Known limitations

- Desktop-first layout. A mobile layout is out of scope for now.
- The browser console shows a Three.js `THREE.Clock` deprecation warning. It is known and accepted for now.
- The production bundle is a single chunk of about 1.3 MB, so Vite prints a chunk-size warning.
