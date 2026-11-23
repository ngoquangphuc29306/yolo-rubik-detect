# RubikVision Phase 3 — Live YOLO26s Guided Scanning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Approved by the user 2026-11-23 (Q1–Q6) with the four corrections of design §15 applied below. Execute on `feat/phase-3-live-vision`; stop at the Task 13 gate.

**Goal:** Real-time guided scanning: a fixed 3×3 guide over the live webcam preview, YOLO26s colours per cell, automatic capture of stable faces, an animated whole-cube rotation cue between faces, then the existing Phase 2 solve and Phase 1 3D guidance.

**Architecture:** Backend `app/vision/` (detector protocol, `YoloDetector` loaded once, frame decoding, pure grid analysis) behind a `/ws/scan` WebSocket; frontend crops the guide square from the unmirrored video, sends one JPEG at a time, and a pure scan machine owns stability, the capture gate and the rotation pause. Demo mode is untouched.

**Tech Stack:** Python 3.12, uv, FastAPI WebSocket, Ultralytics 8.4.216, torch 2.14.1 (CPU), OpenCV; React 19/TypeScript strict, Vitest, Zustand; playwright-cli for the browser gate.

**Spec:** `docs/superpowers/specs/2026-11-23-phase-3-live-vision-design.md`

## Global Constraints

- Branch `feat/phase-3-live-vision` from `main` (`994984e`). No merge, push, remote, git-config change or destructive git. Stage explicit paths; never `.claude/`, `skills-lock.json`, `training/`, weights, datasets, solver tables, MJPEG/test videos.
- Model: only `backend/weights/best.pt` (SHA-256 `93b727eca123fb40e1140f0a34cf50cc90cb50fec7eca7dacfb775e61a1a17e0`). Never retrain, download, replace or modify a checkpoint; never fall back to COCO weights or synthetic detections at runtime. A detector test double exists only under `backend/tests/` and `frontend/tests/`.
- Map class **names** to colours (`blue green orange red white yellow`); never assume class-ID order.
- Backend runtime deps added in this phase exactly: `ultralytics==8.4.216`, `torch==2.14.1` (CPU index), `torchvision` (CPU index, the version paired with torch 2.14.1); OpenCV comes in through Ultralytics. Nothing else without approval. Frontend: no new npm dependencies.
- Frozen: Phase 2 `/health` and `/api/solve` contracts (only `/health` values change as specified), the cube engine, solver, facelet conventions, `SCAN_FACE_ORDER` F→R→B→L→U→D, Demo mode behaviour.
- Wire additions only as in design §6 (Q2); `ApiErrorCode` unchanged.
- Never open the real webcam in automated or agent work; the browser gate uses Chrome's fake device with a local MJPEG; the physical gate is performed by the user.
- Defaults: `RUBIK_CONFIDENCE=0.5`, `RUBIK_IMGSZ=640`, `RUBIK_DEVICE=cpu`, `RUBIK_MAX_FRAME_BYTES=1048576`, `RUBIK_MAX_FRAME_EDGE=1280`, `RUBIK_ALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173`; stability 5 results and 1000 ms; rotation cue ≥ 1500 ms; guide side 0.72 × min(video width, height); crop sent at its native side capped at 640 (never upscaled), JPEG quality 0.85.
- `RUBIK_MODEL_PATH` default is absolute, resolved from `config.py`'s location (`backend/weights/best.pt`); relative env values resolve against `backend/`; never the working directory.
- Default test runs never need the model: real-checkpoint tests carry the `model` marker and pytest `addopts` is `-m 'not slow and not model'`; ordinary tests inject a `Detector` double or a missing model path. Real-model tests run explicitly at the gate (`uv run pytest -m model`).
- Orientation guidance: reference-cube diagrams for the start pose and animated whole-cube rotations for every stage (U and D as return-to-front-then-tilt). Never claim automatic pose or roll verification.
- The scan machine advances only after `onCapture()` returns `true`.
- Every task ends green: backend `uv run pytest`, `uv run ruff check .`, `uv run mypy app`; frontend `npm run lint`, `npm run test` (and `npm run build` for UI tasks), with real output in the task report.

## Review Focus

1. **A face held at the wrong pose that still yields nine valid cells** (e.g. the green face again after a wrong tilt) — must not capture; hint names the fix. Pinned in Task 7 (`gate rejects an already-captured centre`, `D stage after a single tilt shows green again`).
2. **Red/orange flicker on one cell** — must never produce a capture with a flipped colour. Pinned in Task 3 (`ambiguous when runner-up ≥ 0.6× best`) and Task 7 (`stability resets on a changed colour`).
3. **A result arriving after the stage changed, the user rescanned, or the socket reconnected** — must be ignored. Pinned in Task 7 (`stale epoch is dropped`) and Task 6 (`late message after close is ignored`).
4. **Leaving the scanner while a frame is in flight** — camera tracks stop, socket closes, no further frames. Pinned in Task 8 (`unmount mid-flight stops the loop and closes the transport`).
5. **Model file missing or with different class names** — backend still starts, `/health` degraded, Live shows the unavailable panel, solving still works. Pinned in Task 2 (`missing weights → degraded health, /api/solve still 200`, `permuted names map by name`, `wrong names rejected`).

---

## File map

| Path | Responsibility | Task |
| --- | --- | --- |
| `.gitignore` | ignore `training/datasets/`, `training/runs/`, `training/exports/`, `training/*.zip`, `backend/.ultralytics/` | 1 |
| `backend/pyproject.toml`, `uv.lock` | deps, CPU torch index, mypy overrides | 1 |
| `backend/app/config.py` | vision settings | 1 |
| `backend/app/vision/{__init__,detector,yolo_detector}.py` | detector protocol, YOLO loader/inference | 2 |
| `backend/app/api/health.py`, `backend/app/main.py` | vision lifecycle and health | 2 |
| `backend/app/vision/grid.py` | pure cell analysis | 3 |
| `backend/app/vision/frames.py` | JPEG decode and limits | 4 |
| `backend/app/api/scan_ws.py`, `backend/app/schemas.py` | `/ws/scan` protocol and message models | 5 |
| `fixtures/vision/` (Q3) | 3–4 CC BY 4.0 sample images + `ATTRIBUTION.md` | 2 |
| `frontend/src/types/api.ts`, `services/parsers.ts`, `services/scan-transport.ts`, `services/api-config.ts` | wire types, strict parsers, WebSocket transport | 6 |
| `frontend/src/lib/scan-roi.ts`, `features/scanner/live-scan-machine.ts` | pure guide geometry and scan machine | 7 |
| `frontend/src/hooks/useLiveScan.ts` | capture loop | 8 |
| `frontend/src/features/scanner/{LiveScanGuide,RotationCue}.tsx`, `LiveViewport.tsx`, `ScanningScreen.tsx`, `LiveUnavailablePanel.tsx`, `scan-guide.ts`, `tests/golden/legacy-scan-guide.json` | UI | 9 |
| `docs/ARCHITECTURE.md`, `README.md`, `CLAUDE.md`, `docs/superpowers/reports/phase3-verification.md` | docs and evidence | 13 |

---

### Task 1: Git hygiene, dependencies and vision settings

**Files:** Modify `.gitignore`, `backend/pyproject.toml`, `backend/uv.lock`, `backend/app/config.py`; Test `backend/tests/test_config.py`.

**Interfaces:** Produces `Settings` fields `model_path: Path`, `confidence: float`, `imgsz: int`, `device: str`, `max_frame_bytes: int`, `max_frame_edge: int`, `allowed_origins: tuple[str, ...]`, read by `load_settings` from the env names in Global Constraints; `model_path` default = `Path(config.__file__).resolve().parents[1] / 'weights' / 'best.pt'`, relative `RUBIK_MODEL_PATH` resolved against `backend/`; invalid values (confidence outside (0, 1), imgsz not a positive multiple of 32, device not `cpu`/`cuda:N`, non-positive limits, empty origins) → `ConfigError`.

- [ ] **Step 1:** Add the `.gitignore` rules; `git status --short` must no longer list `training/` subfolders except `training/notebooks/`; record it.
- [ ] **Step 2:** Add `[[tool.uv.index]] name="pytorch-cpu" url="https://download.pytorch.org/whl/cpu" explicit=true` and `[tool.uv.sources] torch/torchvision = { index = "pytorch-cpu" }`; `uv add "ultralytics==8.4.216" "torch==2.14.1" torchvision`; mypy overrides `ignore_missing_imports` for `ultralytics.*`, `cv2.*`; record resolved versions and `.venv` size.
- [ ] **Step 3: Failing tests** in `test_config.py`: defaults equal Global Constraints; `test_model_path_default_is_absolute_and_cwd_independent` (monkeypatch.chdir(tmp_path) then `load_settings({})` → same absolute path ending in `backend/weights/best.pt`); `test_relative_model_path_resolves_against_backend` (from a different cwd); each invalid value raises `ConfigError`; origins split on commas and stripped. Register the `model` marker and set `addopts = "-m 'not slow and not model'"`.
- [ ] **Step 4:** Implement; run backend checks (all Phase 2 tests still pass).
- [ ] **Step 5: Commit** `chore(backend): vision dependencies, settings and training ignore rules`.

### Task 2: Detector interface, YoloDetector and health

**Files:** Create `backend/app/vision/__init__.py`, `detector.py`, `yolo_detector.py`, `fixtures/vision/*.jpg` + `ATTRIBUTION.md` (Q3), `backend/tests/vision/test_yolo_detector.py`, `backend/tests/api/test_health_vision.py`; Modify `backend/app/main.py`, `backend/app/api/health.py`.

**Interfaces:**
- `Detection(color: ColorName, confidence: float, xyxy: tuple[float, float, float, float], class_id: int)` (frozen dataclass); `class Detector(Protocol): def detect(self, image: np.ndarray) -> list[Detection]`; `class ModelUnavailable(Exception)`.
- `class_map(names: Mapping[int, str]) -> dict[int, ColorName]` — raises `ModelUnavailable` unless the names are exactly the six colours.
- `YoloDetector(model_path: Path, imgsz: int, confidence: float, device: str)` with `load() -> None` (missing file, wrong task, wrong names, load error → `ModelUnavailable(reason)`; sets `YOLO_OFFLINE=1` and `YOLO_CONFIG_DIR=backend/.ultralytics` before importing Ultralytics; one warm-up predict), `sha256: str`, `model_version: str` (`"<train_args.name or file stem>@<sha256[:12]>"`), `device: str`, `detect(image)`.
- `app.state.vision = VisionState(detector: Detector | None, error: str | None)`; `create_app(settings=None, solver=None, detector=None)` (an injected detector skips loading).
- Health: vision ready → `{"schemaVersion":1,"status":"ok","detectorMode":"yolo","visionReady":true,"solverReady":true,"modelVersion":…,"device":…}`; otherwise `status:"degraded"`, `visionReady:false`, `error:<reason>`.

- [ ] **Step 1: Failing tests:** `class_map` on the real names, on a permuted dict (maps by name), on five names / an extra name (raises); real model (marked `model`; excluded by default; when run explicitly and the weights are absent it fails with an instruction): loads, `sha256` equals the pinned value, `model_version` ends with `@93b727eca123`, `detect` on each `fixtures/vision` image returns only six-colour `Detection`s with confidences in (0, 1] and boxes inside the image; ordinary tests never load the real model (conftest default settings point `model_path` at a missing file; `test_default_suite_does_not_need_weights` asserts that); health with an injected double → ok body; health with `model_path` pointing to a missing file → degraded with reason and `POST /api/solve` on `solved.request.json` still 200.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run backend checks → pass; record load and warm-up time.
- [ ] **Step 5: Commit** `feat(backend): YOLO26s detector loaded at startup and vision health`.

### Task 3: Grid analysis (pure)

**Files:** Create `backend/app/vision/grid.py`, `backend/tests/vision/test_grid.py`.

**Interfaces:** `CellStatus = Literal["ok","missing","ambiguous","misaligned"]`; `Cell(color: ColorName | None, confidence: float | None, status: CellStatus)`; `GridAnalysis(cells: tuple[Cell, ...], grid: tuple[ColorName, ...] | None, valid: bool, reason: str | None)`; `analyze(detections: Sequence[Detection], size: int, rules: GridRules = GridRules()) -> GridAnalysis`; `GridRules` frozen dataclass with the design §5 constants (`min_confidence=0.5`, `ambiguity_ratio=0.6`, `max_center_offset=0.30`, `min_box=0.35`, `max_box=1.10`, `min_aspect=0.6`, `max_aspect=1.67`, `max_area_ratio=2.5`).

- [ ] **Step 1: Failing tests** with a helper that builds nine centred boxes on a 640 crop: complete → grid in row-major order and `valid`; one missing → `INCOMPLETE`, that cell `missing`; duplicate same colour → kept best; two colours with runner-up ≥ 0.6× → `AMBIGUOUS`; runner-up < 0.6× → best kept; low-confidence box ignored; box centre outside crop ignored; off-centre (0.35·c) → `MISALIGNED`; oversized (1.2·c) and thin (aspect 0.5) → misaligned; area ratio 3 → `TILTED`; zero kept → `NO_FACE`; asymmetric layout (all nine colours different positions) round-trips exactly (no rotation/mirroring).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → pass.
- [ ] **Step 5: Commit** `feat(backend): 3x3 cell analysis for the guide crop`.

### Task 4: Frame decoding and limits

**Files:** Create `backend/app/vision/frames.py`, `backend/tests/vision/test_frames.py`.

**Interfaces:** `class FrameError(Exception)` with `code: Literal["FRAME_TOO_LARGE","INVALID_FRAME"]`; `decode_frame(data: bytes, max_bytes: int, max_edge: int) -> np.ndarray` (BGR, H×W×3).

- [ ] **Step 1: Failing tests:** valid 640² JPEG decodes to (640, 640, 3); bytes > limit → `FRAME_TOO_LARGE` before decoding; random bytes, empty, PNG-with-alpha/grayscale → `INVALID_FRAME`; 1300² → `FRAME_TOO_LARGE`; 640×480 (not square within 2 %) → `INVALID_FRAME`.
- [ ] **Step 2–4:** RED, implement (OpenCV `imdecode`), GREEN.
- [ ] **Step 5: Commit** `feat(backend): frame decoding with size and shape limits`.

### Task 5: `/ws/scan` endpoint

**Files:** Create `backend/app/api/scan_ws.py`, `backend/tests/api/test_scan_ws.py`; Modify `backend/app/schemas.py` (Pydantic models for `hello`, `ready`, `frame_result`, `error`), `backend/app/main.py`.

**Interfaces:** Consumes Tasks 2–4. Messages exactly as design §6; one global `asyncio.Lock` around `asyncio.to_thread(detector.detect, image)`; per-connection sequential processing.

- [ ] **Step 1: Failing tests** (`TestClient.websocket_connect` with a detector double that returns nine centred boxes, or none): hello → ready body; frame → `frame_result` with `frameSeq` 1, 2, …, nine `cells`, `grid`, `quality`, `inferenceMs`; first message not hello / bad `schemaVersion` → close 1008 and the double was never called; disallowed `Origin` → close 1008; oversize and non-JPEG frames → `error` with the code and the socket stays open; detector unavailable → `error MODEL_UNAVAILABLE` and close 1011; disconnect mid-inference raises nothing in the app; two connections → inference calls never overlap (double records overlap); the frame bytes never appear in logs (caplog).
- [ ] **Step 2–4:** RED, implement, GREEN.
- [ ] **Step 5: Commit** `feat(backend): /ws/scan protocol with one frame in flight`.

### Task 6: Frontend wire types, parsers and WebSocket transport

**Files:** Modify `frontend/src/types/api.ts`, `services/parsers.ts`, `services/scan-transport.ts`, `services/api-config.ts`; Tests `frontend/tests/services/scan-parsers.test.ts`, `frontend/tests/services/ws-scan-transport.test.ts` (update `scan-transport.test.ts`).

**Interfaces:** `FrameCell {color: ColorName | null; confidence: number | null; status: 'ok'|'missing'|'ambiguous'|'misaligned'}`; `FrameResult` + `cells: FrameCell[]`; `ScanServerMessage` = ready | frame_result | error; `parseScanServerMessage(json: unknown): ParseResult<ScanServerMessage>`; `ScanTransport { available; connect(): Promise<{ok:true; ready: ScanReady} | {ok:false; error: SolveError}>; send(frame: Blob): Promise<{ok:true; result: FrameResult} | {ok:false; error: SolveError}>; close(): void }`; `WebSocketScanTransport(url: string, opts?: {WebSocketImpl?: typeof WebSocket; timeoutMs?: number})` (default 5000); `WS_SCAN_PATH = '/ws/scan'`.

- [ ] **Step 1: Failing tests:** parser accepts the design §6 examples and rejects extra keys, unknown colour, 8 cells, non-finite box, missing `scanId`; transport with a fake WebSocket: connect sends hello and resolves on ready; `send` while pending → rejected with a client error (never two in flight); result for another `scanId` → `BAD_RESPONSE`; timeout → retryable error; server `error` → api error; `close()` mid-send resolves pending with `REQUEST_CANCELLED` and ignores later messages; `UnavailableScanTransport.send` always fails.
- [ ] **Step 2–4:** RED, implement, GREEN (`npm run lint`, `npm run test`).
- [ ] **Step 5: Commit** `feat(frontend): scan wire types, strict parsers and WebSocket transport`.

### Task 7: Guide geometry and the pure live-scan machine

**Files:** Create `frontend/src/lib/scan-roi.ts`, `frontend/src/features/scanner/live-scan-machine.ts`; Tests `frontend/tests/lib/scan-roi.test.ts`, `frontend/tests/features/live-scan-machine.test.ts`.

**Interfaces:** `guideSquare(frame: Size, fraction = 0.72): {x: number; y: number; side: number}`; `cropBoxToFrame(xyxy: Xyxy, square, cropSize: number): Xyxy`; `cropSize(square) = min(round(square.side), 640)`; machine: `LiveScanState {stage: FaceId; phase: 'aligning'|'stabilizing'|'captured'|'rotating'|'done'; epoch: number; streak: {grid: ColorName[]; count: number; since: number} | null; hint: string | null; capturedCenters: Partial<Record<FaceId, ColorName>>; pendingCapture: {face: FaceId; grid: FaceGrid} | null}`; `liveScanReducer(state, event)` with events `RESULT {epoch, result: FrameResult, at}`, `CAPTURE_STORED {epoch}`, `CAPTURE_FAILED {epoch}` (stay on stage, clear streak, hint), `ROTATION_DONE {epoch}`, `RESCAN {face}`, `RESET`; constants `STABLE_RESULTS = 5`, `STABLE_MS = 1000`, `ROTATION_MS = 1500`.

- [ ] **Step 1: Failing tests:** `guideSquare` for 1280×720 and 640×480 (centred, integer pixels); crop→frame mapping of a corner box; stability: 5 identical valid results over ≥ 1000 ms → `pendingCapture`, 5 within 900 ms → not yet, a changed colour or invalid result resets; gate: F with non-green centre → hint, no capture; U with non-white centre → hint; an already-captured centre → hint "We still see …"; D after U where a single tilt shows green again → rejected; after `CAPTURE_STORED` phase `rotating` and results are ignored until `ROTATION_DONE`; stale `epoch` events are dropped; `RESCAN {face, previousCenter}` sets the stage and accepts only a grid whose centre equals `previousCenter`; after D → `done`; after each capture `stage` mirrors the store's next pending face.
- [ ] **Step 2–4:** RED, implement, GREEN.
- [ ] **Step 5: Commit** `feat(frontend): guide geometry and pure guided-scan machine`.

### Task 8: `useLiveScan` capture loop

**Files:** Create `frontend/src/hooks/useLiveScan.ts`, `frontend/tests/hooks/useLiveScan.test.tsx`.

**Interfaces:** `useLiveScan({enabled: boolean; video: HTMLVideoElement | null; createTransport: () => ScanTransport; onCapture: (face: FaceId, grid: FaceGrid) => boolean}) => {connection: 'idle'|'connecting'|'live'|'error'; state: LiveScanState; lastResult: FrameResult | null; errorMessage: string | null}`. Crops with `guideSquare` to a canvas of `cropSize(square)` (≤ 640, never upscaled), `toBlob('image/jpeg', 0.85)`, one `send` at a time; calls `onCapture` (→ `useScanStore.captureFace(face, grid, 'live')`) and dispatches `CAPTURE_STORED` **only if it returned `true`**, otherwise `CAPTURE_FAILED`; schedules `ROTATION_DONE` after `ROTATION_MS`; ≥ 5 consecutive frame errors → stop with message.

- [ ] **Step 1: Failing tests** (fake transport, fake timers, stub canvas/`toBlob`): `test_capture_failure_keeps_stage` (`onCapture` returns false → no `CAPTURE_STORED`, stage unchanged, streak cleared, hint shown, scanning continues); never two sends in flight; no sends while `rotating`; capture stores the grid once; unmount mid-flight closes the transport and sends nothing more; `enabled=false` never constructs a transport (Demo isolation); reconnect after error uses a new transport.
- [ ] **Step 2–4:** RED, implement, GREEN.
- [ ] **Step 5: Commit** `feat(frontend): live capture loop with one frame in flight`.

### Task 9: Guided-scan UI

**Files:** Create `frontend/src/features/scanner/LiveScanGuide.tsx`, `RotationCue.tsx`; Modify `LiveViewport.tsx`, `ScanningScreen.tsx`, `LiveUnavailablePanel.tsx`, `scan-guide.ts`, `frontend/tests/golden/legacy-scan-guide.json` (U and D wording only, design §7); Tests `frontend/tests/features/live-scan-ui.test.tsx` (+ update existing scanner tests).

- [ ] **Step 1: Failing tests:** the F stage shows the start-pose reference cube (green toward the camera, white on top) before any capture; each transition shows a reference-cube rotation animation for the next stage (U and D as return-to-front-then-tilt) with an accessible text equivalent; the copy never claims pose or roll verification (`not.toHaveTextContent(/verified|detects? (your )?orientation/i)`); with readiness `ready` and an active camera the guide renders nine cells; cell fills use the recognized colour; missing/ambiguous/misaligned cells show their distinct markers and accessible labels; the stability ring reflects the streak; `rotating` shows `RotationCue` with the next-stage direction and text; no "Capture Face" button in Live (the footer is a status strip) and the guide does not overlap the strip; Live with readiness not ready shows `LiveUnavailablePanel` and no guide; Demo screens are unchanged (existing demo tests pass untouched); U/D copy says to return to the front first.
- [ ] **Step 2–4:** RED, implement (existing theme, no redesign), GREEN; `npm run build`.
- [ ] **Step 5: Commit** `feat(frontend): live 3x3 scan guide, per-cell feedback and rotation cue`.

### Task 10: Integration and isolation checks

**Files:** Tests only: `frontend/tests/features/live-scan-flow.test.tsx`, `backend/tests/api/test_scan_ws_real_model.py`.

- [ ] Frontend flow with a fake transport scripted per stage: six faces captured in F→R→B→L→U→D order → `buildSolveRequest` equals the scripted grids → existing `runSolve` path (mocked solver client) → Alignment reachable; rescan of one face; Demo never constructs a WebSocket.
- [ ] Backend real model through `/ws/scan` (marked `model`, excluded by default): each `fixtures/vision` image (resized square crop) yields a parseable `frame_result` (grid validity not asserted).
- [ ] Full backend and frontend checks. **Commit** `test: live scan flow and real-model protocol checks`.

### Task 11: Browser gate (no real webcam)

No commits; evidence in the git-ignored workspace.

- [ ] Build an MJPEG locally from `fixtures/vision` (or `training/` test images) where one face fills the centre; never commit it.
- [ ] Backend (`uv run uvicorn --factory app.main:create_app --host 127.0.0.1 --port 8000`) + `npm run dev`; playwright-cli Chrome with `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream --use-file-for-fake-video-capture=<file>`; prove every `videoinput` label is the fake device before enabling the camera.
- [ ] Record at 1440×900: `/health` ok and visionReady; guide visible; boxes overlay the video within 4 px of the sticker positions; nine cells coloured; auto-capture and rotation cue (or NOT RUN if no suitable image fills the guide); socket and tracks closed on leaving; console errors.
- [ ] Stop servers by PID; ports closed; `git status` clean.

### Task 12: Physical webcam gate (user-run)

- [ ] Hand the user a checklist (design §10 table) and a results template; the user runs five sessions with a real cube; the assistant only reads the results, backend logs (inference ms, reasons) and screenshots the user provides. Any wrong capture or > 10 % failed face attempts stops the phase (design §5.4).

### Task 13: Documentation, verification report and final gate

**Files:** Modify `docs/ARCHITECTURE.md` (v1.3: §5.4 runtime contract, §6.2–6.3 guide/auto-capture, §8.1 status, §8.2 protocol as built, §10 tree, §11 resources/licence, §13 roadmap: Phase 3 redefined as real-vision scanning, §14 findings F1–F5), `README.md` (vision setup, env vars, offline model note), `CLAUDE.md` (status line only); Create `docs/superpowers/reports/phase3-verification.md`.

- [ ] Fresh gate: `uv sync --locked`, default `uv run pytest` (must pass without relying on weights), then explicitly `uv run pytest -m model` and `uv run pytest -m slow`, ruff, mypy; `npm ci`, lint, test, build; live WebSocket smoke via the Vite proxy; whole-branch review (independent reviewer); browser and physical gate results copied as observed; PASS / FAIL / NOT RUN per item. **Commit** `docs: Phase 3 live vision architecture, README and verification report`. Stop for approval.

---

## Dependencies and milestones

```text
M1 backend vision   T1 → T2 → T3 → T4 → T5
M2 frontend         T6 → T7 → T8 → T9          (T6 needs T5's message shapes)
M3 integration      T10 → T11 (browser gate) → T12 (physical gate, user)
M4 docs and gate    T13
```

Review checkpoints: after every task an independent spec reviewer and an independent code-quality reviewer (Sonnet; one combined reviewer for test-only/docs tasks); whole-branch review before T13's gate. Stop conditions: a model, contract or orientation problem; any wrong capture in the physical gate; any change needed to the cube engine, solver or Phase 2 contracts.
