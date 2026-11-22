# RubikVision

RubikVision helps you solve a physical 3x3 Rubik's Cube. The intended flow is a guided webcam scan, YOLO facelet detection, cube reconstruction with a Kociemba solution, and a Three.js digital twin that walks you through the moves on a timer.

## Status

The project is being built model-last.

- **Frontend (`frontend/`)**: React app with the six-screen flow (Landing, Scanning, Reconstruction, Alignment, Solving, Completion). It is complete in **demo** mode.
- **Backend and model**: not implemented yet. There is no FastAPI server, no solver service and no trained YOLO weights. Live scanning is therefore blocked.
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

The dev server only listens on `127.0.0.1`. It proxies `/api`, `/health` and `/ws` (WebSocket) to `127.0.0.1:8000`, where the future backend will run. No environment variables are required.

## Demo and Live

- **Demo** is simulated. The scan, detections and solution come from deterministic fixtures, and every demo workflow screen carries a visible "Demo" label (the Landing hero is a labelled illustration). A finished demo only means the instructions ended. It says nothing about a real cube.
- **Live** needs the backend and model, which do not exist yet, so it is blocked and says so. It never falls back to fixtures silently.
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
docs/              architecture, plans and phase reports
```

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): product behaviour, geometry, API contracts and release criteria
- [docs/superpowers/](docs/superpowers/): implementation plans and verified phase reports

## Known limitations

- Desktop-first layout. A mobile layout is out of scope for now.
- The browser console shows a Three.js `THREE.Clock` deprecation warning. It is known and accepted for now.
- The production bundle is a single chunk of about 1.3 MB, so Vite prints a chunk-size warning.
