# RubikVision — Frontend Review & Model-Last Implementation Handoff

Date: 2026-11-19 | Status: proposed execution roadmap for review; not implemented

Input: Google AI Studio export `untitled.zip`, and `ARCHITECTURE.md` v1.0 (577 lines). Read architecture first. Preserve its product and state contracts, except the explicitly proposed sequencing and readiness changes in this handoff. The user wants to refactor the existing frontend, build and integrate the real backend with test fixtures, and train the custom detection model last. Do not train or implement application code in the review step.

## 1. Review evidence

The ZIP is a standalone Vite frontend, not a full-stack monorepo. It already includes React, TypeScript, Tailwind, Zustand, Three.js, React Three Fiber, Drei, Motion, Lucide, six screens, and reusable UI elements. Preserve the dark emerald design, typography and six-screen flow. There is no Python backend, real inference client, Kociemba integration or automated test suite in the archive.

| Priority | File / evidence | Required change |
|---|---|---|
| P0 | `src/screens/ScanningScreen.tsx:83-120` timer-based readiness/stability; `:37`, `:306-316` static confidence and target colors | Isolate simulator. In live mode derive captures and overlays from actual results only. |
| P0 | `ScanningScreen.tsx:122-153` real camera retrieval but no frame transport; `:255` mirrored object-cover preview | Unmirrored image and coordinate-consistent contain preview; single-in-flight JPEG transport; stop tracks on exit/failure. |
| P0 | `src/store/useRubikStore.ts:99-185` preset session, `captureCurrentFace` copies `targetFaces` | Use actual accepted ordered grid, separate demo and live sessions; no fallback to mock colors. |
| P0 | `src/screens/ReconstructionScreen.tsx:44-76` merges missing faces with target faces, timer and forced-invalid flag | Never fill missing data; call real solver, surface real validation errors. |
| P0 | `src/lib/cubeEngine.ts:427-446` reverses preset scramble | Keep as explicitly marked demo fixture only. Real solution from Python Kociemba. |
| P0 | `cubeEngine.ts:79-145` fixed red/right, blue/back etc.; `:375-406` silently substitutes W for missing sticker | Keep demo scheme, derive live centers from scan and fail closed on missing stickers. Explicit U/D transitions. |
| P0 | `SolvingScreen.tsx:124-197` countdown logic; `RubiksCube3D.tsx:423-439` animation advances independently of pause | Single controller owns animation and countdown progress, suspend both on pause, hidden tab or rescan; guard stale callbacks. |
| P0 | `SolvingScreen.tsx:66-77,239-241` assumes nonempty moves, division by zero on solved input; `:219-232` manual next can bypass delay | Handle empty moves directly, don't show NaN; avoid skip/previous that silently invalidate physical progress. Final delay must complete. |
| P1 | `SolvingScreen.tsx:455-460` disables auto-reposition and fixed camera | Add clear target-face/bottom/back viewpoint and persistent canonical orientation indicator. Viewpoint never changes logic. |
| P1 | `CompletionScreen.tsx:73-84` automatic confetti and padded time using `Math.max` | Show guidance complete, actual elapsed time, optional celebration after human confirmation. |
| P1 | `package.json`, `.env.example`, `README.md`, `vite.config.ts`, `tsconfig.json` | Clean unused AI Studio/Gemini/Express dependencies only after usage check; no Gemini key needed; correct aliases, asset imports, local proxy, consistent package manager/lockfile. |

Verification performed in review environment: compiled only `src/lib/cubeEngine.ts` using global `tsc --target ES2022 --module commonjs --strict`, then ran 75 Node assertions: three preset scrambles + inverse solutions reach solved; 54 move/inverse checks (18 moves × 3 scrambles); 18 four-quarter-turn checks (6 faces × 3 scrambles). All passed. These are internal invariance tests, not independent Kociemba equivalence, WebGL or app tests. Node v22.16.0 available; dependency installation, full production build and browser rendering not run. No code modified in the user's archive. No backend or weights exist in archive.

## 2. Architecture review and proposed v1.1 changes

Keep sections 1–12 of `ARCHITECTURE.md` as the design baseline, subject to the following explicit changes. Record approved changes in the repository architecture rather than maintaining contradictory documents.

- §3, §5.4, §8 and §11: backend must start with no weights. `GET /health` indicates process and solver availability independently of vision. Add explicit `RUBIK_DETECTOR_MODE=fixture|yolo` (production/local live default `yolo`); fixture mode is opt-in, clearly marked, and never accepts arbitrary webcam images as if detected. Missing/invalid weights in yolo mode yield `MODEL_UNAVAILABLE`, real scan blocked, solver remains usable. Do not silently download/use generic COCO weights. Explicit fixture replay may use recorded/synthetic frame results; synthetic results must not imply actual observation.
- §5.1: six labels only: 0 white, 1 yellow, 2 red, 3 orange, 4 blue, 5 green. Normalize from recognized model names and verify all six classes and detection task at startup; reject extra/missing/unknown labels. Curated training IDs fixed. Model adapter emits canonical color IDs irrespective of source ID order, if deliberately remapped and documented. Weights are not committed; load a trusted local `best.pt` once. Restart after replacement (no hot-reload required).
- §5.2: add ColorRubik2 as priority audit candidate, Pavitras as backup (six color + extra labels need audit). No dataset selected yet. §5.3's 50 vs later suggested 60 epochs is a tunable baseline, not a contract. Keep training late; collect a small independent set of real images/known cube states early for fixtures and final validation.
- §6: normative sequence `F R B L U D`; canonical state order `URFDLB`. Follow the coordinate/neighbor table verbatim; initial F green toward webcam and U white up; solve F toward human. Known centers from scan, not hardcoded R/B/L/D. Verify transition back to F before U, and 180° whole-cube tilt U→D. Nine boxes cannot prove face roll or hidden neighbor orientation: present guidance, don't claim full pose verification.
- §8.1: health fields can be additive: `schemaVersion`, `status`, `detectorMode`, `visionReady`, `solverReady`, `modelVersion`, `device`, and optional safe error. WebSocket protocol and REST solve contract remain v1. Define ROI exactly before implementation: e.g. normalized `roi` in hello, applied server-side to decoded full unmirrored frame, never unrelated DOM pixels. Shared contain transform for overlay (scale=min(viewW/frameW, viewH/frameH); add letterbox offsets); send config consistently. If ROI changes, reset scan/handshake. Keep one in-flight frame per connection, drain/ignore on stage changes and rescan. Treat fixture mode as explicitly opted-in.
- §7: immutable canonical facelet snapshots remain source of truth. Existing `CubieState[]` is a derived renderer adapter, not authoritative independent state. Preserve move directions from §7.2. Add strict runtime parsing, conversion from response initialState+centerColors; an empty solution skips playback; use precomputed snapshots. Delay is after animation, 5s default, 2–15s, speed change next step, pause resumes both phases, replay cannot re-apply moves, final delay not skipped; ignore stale callbacks.
- §13: replace model-first sequence with stages in §5 below. Update P0 release criteria to distinguish software-ready (fixture integration) and actual model-ready (custom weights + real physical verification). Neither test fixtures nor mock mode establish detector accuracy.

No need to rewrite the architecture or change product scope. Section 10 explicitly permits file layout simplification provided boundaries are maintained; an exact filename match is not the goal.

## 3. Migration mapping

Create a Git branch from a clean baseline (or initialize git if user agrees); preserve original ZIP. First make a behavior-preserving relocation, then incremental changes. Never delete a working UI to satisfy a directory tree. Preserve existing asset attribution/license headers.

| Current relative path | Destination / responsibility |
|---|---|
| `package.json`, `bun.lock`, `vite.config.ts`, `tsconfig.json`, `index.html`, `.env.example` | `frontend/` (frontend owns its build and lockfile) |
| `src/App.tsx`, `main.tsx`, `index.css`, `assets/` | `frontend/src/` |
| `src/components/ui/*`, `BrandMark.tsx`, `WorkspaceHeader.tsx`, `FaceGrid2D.tsx` | `frontend/src/components/` |
| `src/screens/LandingScreen.tsx` | `frontend/src/features/landing/LandingScreen.tsx` |
| `src/screens/ScanningScreen.tsx` | `frontend/src/features/scanner/ScanningScreen.tsx` + camera/scan hooks and overlays |
| `src/screens/ReconstructionScreen.tsx` | `frontend/src/features/review/ReconstructionScreen.tsx` |
| `src/screens/AlignmentScreen.tsx` | `frontend/src/features/align/AlignmentScreen.tsx` |
| `src/screens/SolvingScreen.tsx` | `frontend/src/features/solver/SolvingScreen.tsx` |
| `src/screens/CompletionScreen.tsx` | `frontend/src/features/solver/CompletionScreen.tsx` |
| `src/components/three/*` | retain under `frontend/src/components/three/` or feature/cube; choose a single location |
| `src/lib/cubeEngine.ts` | `frontend/src/engine/cube-state.ts`, `move-engine.ts`, plus presentation metadata and test/demo fixtures |
| `src/store/useRubikStore.ts` | `frontend/src/stores/` (split scan/cube/playback or composed slices, with one session lifecycle) |
| `src/lib/utils.ts` | `frontend/src/lib/utils.ts` + audio helper if useful |
| `.gitignore`, `README.md` | root with updated local instructions; do not replace ARCHITECTURE.md |
| `metadata.json` | preserve if needed by AI Studio, otherwise archive/remove only after verifying no runtime use |

Target layout, aligned with §10 and the actual frontend:

```text
rubikvision/
  ARCHITECTURE.md
  README.md
  .gitignore
  frontend/
    package.json
    bun.lock                 # retain initially; choose a single tested package manager
    vite.config.ts
    tsconfig.json
    index.html
    .env.example
    src/
      App.tsx
      main.tsx
      index.css
      assets/
      components/{ui,three}/
      features/{landing,scanner,review,align,cube,solver}/
      engine/{cube-state.ts,move-engine.ts,playback-fsm.ts}
      stores/{scan-store.ts,cube-store.ts,playback-store.ts}
      hooks/{useCamera.ts,useScanSession.ts,usePlayback.ts}
      services/{health-client.ts,scan-client.ts,solver-client.ts}
      types/{cube.ts,api.ts}
      lib/
      demo/                   # explicit simulation only
    tests/
  backend/
    app/
      main.py
      config.py
      api/{health.py,scan.py,solve.py}
      schemas/{vision.py,cube.py,errors.py}
      vision/{detector.py,fixture_detector.py,yolo_detector.py,facelet_sorter.py,grid_validator.py}
      cube/{reconstruction.py,validator.py,solver.py}
    weights/                 # best.pt supplied later
    tests/
    requirements.txt
    .env.example
  training/{configs,notebooks}/
  datasets/                  # ignored
  fixtures/                  # small synthetic/consented test data and API JSON
  docs/superpowers/{specs,plans}/
```

During relocation update Vite alias `@` and TypeScript paths to `./src`, replace `@/src/...` with `@/...`, import the JPEG module rather than hardcoding `/src/assets/...`; remove asset-copy plugin only after production asset verification. Keep build reproducible; don't blindly change dependency versions or switch lockfiles. Existing Windows-incompatible `clean` script can be made portable. Keep local frontend on localhost:5173 unless retaining 3000 consistently; Vite proxy `/api`, `/health`, `/ws` (upgrade enabled) to 127.0.0.1:8000. Do not bind public network by default. Gitignore datasets, runs, weight binaries, virtualenvs, `.env`, node_modules, dist. Keep examples tracked.

## 4. Critical integration contracts

- Keep architecture REST request `{schemaVersion:1, faces:{U:[...9 colors],R:[...],F:[...],D:[...],L:[...],B:[...]}}`; response `{schemaVersion:1,centerColors,initialState,moves,moveCount}`. Reject missing, invalid, duplicate centers and illegal physical state; never re-use a fake valid response. Kociemba independent of detector readiness.
- WebSocket hello with scanId, schemaVersion and normalized ROI; raw JPEG binary with one frame in flight; JSON result schema as in §8.2. `grid` nullable, nine row-major color strings; quality valid only when grid geometry passes; derive real detection count/confidence/overlay from message, not constants. UI owns stability & order. Invalid grid resets stability. In demo fixture mode explicitly replay full detection boxes through the same geometry/validation service if testing integration.
- Backend interface proposal: `Detector.detect(frame: np.ndarray) -> list[Detection]` (pixel `xyxy`, canonical classId, color, confidence). `FixtureDetector` yields deterministic test cases; `YoloDetector` loads trusted custom checkpoint via `Ultralytics.YOLO` once. `analyze_frame` performs shared filtering, ordering & quality checks. No fixture fallback in yolo mode.
- TypeScript engine proposal: `parseFaceletState(state: string, centerColors: CenterColors): FaceletState`, `applyMove(state: FaceletState, move: MoveNotation): FaceletState`, `buildSnapshots(state, moves): FaceletState[]`, `toCubies(state, centerColors): CubieState[]`. Use §6.4 exact coordinates; strict validate length, symbols, centers/counts and legal token strings. Reuse tested integer cubie rotation code behind conversion if desired. Avoid a second competing state model.
- Backend sends full color names; current frontend uses W/Y/R/O/B/G. Normalize at one explicit boundary. Face direction `R` != red color token. Use dynamic center mapping for all live colors and orientation instructions. Preserve a fixed mapping for demo only.
- Every accepted solution must replay to exact canonical solved string in frontend before playback. Test with independently known asymmetric URFDLB cases, not only inverses from the same engine.

## 5. Model-last execution roadmap

This is an architecture-level task roadmap, not an approved full TDD implementation plan; Claude Code should generate focused Superpowers plans for each phase from these interfaces and repository state, then request review before implementing. Each phase ends with runnable software or tests.

### Phase 0 — preserve baseline and verify prerequisites

- [ ] Inspect working tree and manifests. Record Git status, current build/TS errors and runtime version requirements. No credentials. If no repo, don't commit without authorization.
- [ ] Install with the existing package manager/lockfile on the user's machine (if Bun lock retained use `bun install --frozen-lockfile`; don't introduce npm lock silently). Run existing typecheck (`bun run lint`) and build (`bun run build`). If dependency resolution fails, record exact failures and choose compatible pinned versions deliberately.
- [ ] Browser smoke test 6 screens in demo mode, desktop/laptop viewport and mobile fallback. Save local screenshots (no personal camera captures without permission).
- Gate: clean baseline report, not assumed green. Preserve visual evidence and original archive.

### Phase 1 — frontend refactor, still explicit demo

- [ ] Write regression tests first for existing cube engine and routes. Move frontend root and aliases/assets; confirm demo behavior unchanged. Add Vitest/React Testing Library or equivalent compatible tooling.
- [ ] Extract features, store slices, camera lifecycle, overlay and playback controller; remove unused scaffold deps only after audit.
- [ ] Define typed API and fixture responses; explicit `demo` vs `live` mode. Never overlay fake boxes on live camera. Demo may run fully offline with banner; live shows unavailable if backend absent.
- [ ] Fix P0 pause/resume both phases, empty moves, completion time, replay, final delay, stale callback handling. Keep autoplay with adjustable delay, no required Next clicks.
- Gate: typecheck, unit tests, build, desktop UI regression; demo still solves a known cube; real scan blocked while no backend.

### Phase 2 — real deterministic backend (no model)

- [ ] FastAPI config/health, Pydantic contracts, errors, test client. Create Python 3.11 venv; lock tested packages including kociemba. Keep YOLO optional/lazy in fixture mode.
- [ ] Implement real color-grid reconstruction and Kociemba adapter, legality checks, timeout/error paths. Tests: solved empty, missing grids, 10/8 color counts, duplicate centers, swap edges, corner twist, edge flip, known scramble with independent expected state. Assert move replay reaches solved by independent reference.
- [ ] Integrate frontend `/api/solve` response, canonical state → renderer adapter, independent cross-language golden fixtures with all six axes and 18 move tokens. Test custom center mapping. Prevent partial/invalid solution from entering alignment/playback.
- Gate: actual solver acceptance with fixtures and 3D replay; no weight file needed. `pytest backend/tests`, frontend lint/test/build succeed (commands adapted to chosen environment).

### Phase 3 — vision service + synthetic and recorded fixtures

- [ ] Define detector provider; implement deterministic fixture detector and real geometry for nine boxes. Test shuffled, missing, duplicates, 10 boxes, wrong ROI, tilted, inconsistent spacing and confidence cases.
- [ ] Implement WebSocket v1, hello/ack, validation, limits, sequencing, backpressure, error/recovery and single worker. Fixture mode clearly identified in health and UI. Test no weights at startup and no live scan fallback.
- [ ] Collect small independent webcam frames/ground truth now (with permission) to validate camera, ROI, representation and eventual model. Do not train yet. Optional replay from recorded detections must be identified as simulation; not live inference.
- Gate: fixture stream through shared geometry + scan controller + real solver, full real state contract. Live missing model returns MODEL_UNAVAILABLE.

### Phase 4 — full integration without trained weights

- [ ] Webcam binary frame transport, bbox overlay with correct scaling, one in-flight frame, stale result rejection, stage stability and capture lifecycle. Validate first F green, U white, unseen other centers; no duplicate centers. Review all six actual accepted grids; no synthetic fill. Make U/D guide explicitly show adjacent center orientations. Test transition state reset and safe full restart.
- [ ] Implement live `YoloDetector` adapter now: startup task/name checks, normalized results, device config, bounded inference, mock/stub model unit test, useful model-unavailable status. No generic COCO fallback. A test double can exercise loading/result handling; can't certify inference accuracy before custom weights exist.
- [ ] Full fixture e2e: scan → review → solve → align → autoplay → completion and scan again, invalid state, hidden tab, permissions, reconnect, empty solution, no camera during solve, delayed response after rescan, real missing model. Ensure only intentional demo presents fake data.
- Gate: **software ready**, exact contracts compile and tests pass. No claim that physical cube scan is ready yet. This is the point to proceed with training.

### Phase 5 — dataset and training (deferred until software gate)

- [ ] Audit selected data; verify bounding boxes, six canonical labels, license, class distribution, split by source before augmentation, no hue changes; independent webcam holdout. Prefer ColorRubik2 after audit; do not merge prematurely.
- [ ] Fine-tune YOLO26n on Colab, record config/seed/versions/hyperparameters and evaluation. Use appropriate batch, no hue-changing augmentation. Export `best.pt` plus metadata/hash.
- [ ] Copy trusted weight to `backend/weights/best.pt`, select yolo mode and restart backend; validate health, class names, actual inference. Record device/latency and tune confidence/ROI/stability only after real results. Treat architecture metrics as provisional, not promises.
- Gate: **model ready** only after real detection and held-out tests, exact 9-sticker face states, full 54-sticker physical reconstruction, known scramble and user following physical solution. Demonstrate no-camera solving and deliberate rescan recovery. No fake data masquerading as real inference.

## 6. Acceptance matrix

| Requirement | Before custom weights | After custom weights |
|---|---|---|
| Frontend, 3D, moves, timer, solver | Real code, golden fixtures and tests | Same modules |
| API, geometry, scan FSM | Real code with injected fixture detections | Real results through same contracts |
| Live camera capture | Real media lifecycle and JPEG transport | Real vision overlay |
| Detector inference | Provider contract and test double; no actual custom inference | YOLO26n inference and measurements |
| Physical cube solved | Cannot claim full live solution | Verify on real known scrambles |

## 7. First Claude Code request

Use Superpowers (brainstorming/review then writing-plans for the approved Phase 1 design; use executing-plans or subagent-driven-development only after plan approval). Read `ARCHITECTURE.md` and this handoff, inspect actual repo files and Git status, and validate all assumptions. Work in incremental phases, no rewrite or premature training. Start by producing a Phase 0/1 implementation plan at `docs/superpowers/plans/2026-11-19-frontend-refactor.md` with exact files, tests, commands and regression gates. Preserve current UI and cubie engine, avoid unnecessary new dependencies. Document proposed architecture v1.1 amendments from §2 for review. No code changes, model training, dependency installation or commits before user approves the plan. Once approved, implement only that phase, run tests and build, report source changes and remaining risks; then plan backend separately. Do not claim unexecuted tests as passing.
