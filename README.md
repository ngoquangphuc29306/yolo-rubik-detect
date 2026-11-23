# RubikVision

RubikVision helps you solve a physical 3x3 Rubik's Cube. The flow is a guided webcam scan, YOLO26s facelet detection, cube reconstruction with a Kociemba solution, and a Three.js digital twin that walks you through the moves on a timer.

## Status

The software was built in phases; Phases 0 to 2 are merged and Phase 3 awaits approval.

- **Frontend (`frontend/`)**: React app with the six-screen flow (Landing, Scanning, Reconstruction, Alignment, Solving, Completion). It is complete in **demo** mode.
- **Backend (`backend/`)**: a FastAPI service with `GET /health`, `POST /api/solve` (cube validation and a real two-phase solver; Phase 2, merged) and `/ws/scan` (live YOLO26s scanning; Phase 3). Phase 3 is implemented on branch `feat/phase-3-live-vision` and awaits approval.
- **Live scanning (Phase 3)** needs the trained YOLO26s checkpoint, which is not in this repository (see below). Without it the backend still starts and solves, but reports vision as unavailable and Live scanning stays blocked.
- It was exercised in a browser only with Chrome's fake camera device. The test with a real webcam and a real cube has **not been run** (`docs/superpowers/reports/phase3-physical-test-checklist.md`), and nothing here has been verified against a physical cube.

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

The backend lives in `backend/` (Python 3.12, FastAPI, managed with [uv](https://docs.astral.sh/uv/)). It serves `GET /health`, `POST /api/solve` and the `/ws/scan` WebSocket on loopback only. All commands run from `backend/`.

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
uv run pytest             # default suite; excludes the slow cross-check and the real-model tests
uv run pytest -m slow     # 300 real solves replayed in Python (about 23 s)
uv run pytest -m model    # real-checkpoint tests; need backend/weights/best.pt (see below)
uv run ruff check .
uv run mypy app
```

The tests need the solver tables. If they are missing, the solver fixtures fail (they never skip) and print the prepare command. The default suite does not need the model: a checkout without `backend/weights/best.pt` passes it. The `model` tests fail with an instruction (they do not skip) when the weights are missing.

Environment variables (read once at startup):

| Variable | Default | Meaning |
| --- | --- | --- |
| `RUBIK_DETECTOR_MODE` | `yolo` | Only `yolo` is accepted. |
| `RUBIK_SOLVER_CACHE_DIR` | `backend/.solver-cache/` | Parent directory of `tables/`. |
| `RUBIK_SOLVER_TIMEOUT_S` | `10` | Solver time limit in whole seconds. A timeout returns 503 `SOLVER_TIMEOUT`. |
| `RUBIK_MODEL_PATH` | `backend/weights/best.pt` | Detection weights. A relative value is resolved against `backend/`, not the current directory. |
| `RUBIK_CONFIDENCE` | `0.5` | Detection confidence threshold, a number between 0 and 1 (exclusive). Raising it tightens detection; values below 0.5 have no effect on the grid, which applies its own 0.5 floor (`GridRules.min_confidence` in `backend/app/vision/grid.py`). |
| `RUBIK_IMGSZ` | `640` | Inference size, a positive multiple of 32. `480` is the documented speed lever; change it only after the physical test. |
| `RUBIK_DEVICE` | `cpu` | `cpu` or `cuda:N`. Only CPU torch is installed, so `cuda:N` makes vision unavailable. |
| `RUBIK_MAX_FRAME_BYTES` | `1048576` | Largest accepted `/ws/scan` frame in bytes. |
| `RUBIK_MAX_FRAME_EDGE` | `1280` | Largest accepted frame edge in pixels. |
| `RUBIK_ALLOWED_ORIGINS` | `http://127.0.0.1:5173,http://localhost:5173` | Comma-separated `Origin` values accepted by `/ws/scan` (exact match). |

### Live scanning (Phase 3)

- **Weights.** Place the trained YOLO26s checkpoint at `backend/weights/best.pt`. It is git-ignored and is not in this repository. The backend loads it once at startup and checks that it is a detection model with exactly the six colour class names (classes are mapped by name, never by ID).
- **Without the weights** the backend still starts. `/health` reports `status: degraded` and `visionReady: false` with a short reason, `/ws/scan` answers `MODEL_UNAVAILABLE`, the Live screen says the vision model is not available, and `POST /api/solve` keeps working. It never falls back to fixture or generic weights.
- **Start** with the same command as above (`websockets` is a locked dependency, so `uv sync` is enough). With the model loaded, `/health` shows `visionReady: true` and the model version.
- **Origin rule.** `/ws/scan` accepts only the dev server proxy origins `http://127.0.0.1:5173` and `http://localhost:5173` (change them with `RUBIK_ALLOWED_ORIGINS`); anything else is rejected during the handshake with HTTP 403. Use `npm run dev`: `npm run preview` has no proxy and is not supported for live scanning.
- **Real-checkpoint tests.** `uv run pytest -m model` runs the tests that load `best.pt` and the sample images in `fixtures/vision/` (CC BY 4.0, see `fixtures/vision/ATTRIBUTION.md`). They are excluded from the default run.
- **Offline.** Ultralytics runs offline (`YOLO_OFFLINE=1`) and never downloads weights. Its settings directory `backend/.ultralytics/` is created on first start and is git-ignored.
- **Performance.** Inference runs on the CPU. On the development machine (4-core Intel i3-9100F, browser and dev server on the same machine) the fake-camera gate measured inference p95 of 303 to 1037 ms per scan and 2.7 results per second, which is above the 300 ms budget. The physical test decides whether `RUBIK_IMGSZ=480` is needed.
- **Physical test.** The test with a real webcam and cube is run by the user, not by the assistant: follow [docs/superpowers/reports/phase3-physical-test-checklist.md](docs/superpowers/reports/phase3-physical-test-checklist.md). It has not been run.
- **Known limits.** There is no idle timeout, message-size limit or connection cap on `/ws/scan` (loopback only). The scan checks centre colours, not how the cube is held: it cannot prove whole-cube orientation or face roll.
- **`training/`.** The `training/` folder is the user's own training workspace and is not part of the repository. Its datasets, runs, exports and zip files are git-ignored; the rest is left untracked and must never be committed.

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
- **Live** needs the backend and the trained model. Without a usable model Live is blocked and says "Vision model is not available — the solver is still usable". It never falls back to fixtures silently. Demo never opens the WebSocket.
- The camera is used only after you press "Enable camera". While you scan, a small square crop of the video (the guide square) is sent to the local backend over the loopback WebSocket for detection. It is not stored, logged or sent anywhere else. The camera, the socket and the capture loop stop after the sixth face or when you leave the scan screen.

## Privacy

- No webcam frames are stored. During a live scan the guide crop is sent to your own backend on `127.0.0.1` only (not to any cloud service); in Demo nothing is sent.
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
  src/services/    typed, validated transport boundaries (health, solve, scan WebSocket)
  src/lib/         pure helpers, including the guide geometry and the live-scan state machine
  tests/           Vitest suites
fixtures/          shared JSON fixtures for the API contracts (vision/: sample images and recorded WebSocket messages)
backend/
  app/api/         /health, /api/solve and /ws/scan routes
  app/cube/        pure facelet state, geometry, moves and legality
  app/solver/      solver adapter, service and the table prepare command
  app/vision/      YOLO26s detector, frame decoding limits and the 3x3 cell analysis
  weights/         git-ignored; best.pt goes here
  tests/           pytest suites (cube, solver, api, vision, crosscheck)
docs/              architecture, plans and phase reports
```

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): product behaviour, geometry, API contracts and release criteria
- [docs/superpowers/](docs/superpowers/): implementation plans and verified phase reports

## Known limitations

- Desktop-first layout. A mobile layout is out of scope for now.
- The browser console shows a Three.js `THREE.Clock` deprecation warning. It is known and accepted for now.
- The production bundle is a single chunk of about 1.3 MB, so Vite prints a chunk-size warning.
