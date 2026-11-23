# RubikVision — Phase 3 Technical Design: Live YOLO26s guided scanning

| Field | Value |
| --- | --- |
| Status | **Approved by the user 2026-11-23 (Q1–Q6 as defaulted)**, with the four corrections in §15 applied. |
| Date | 2026-11-23 |
| Baseline | `main` = `994984e` (Phase 0–2 merged), verified 2026-11-23. Untracked: `.claude/`, `skills-lock.json`, `training/` (not git-ignored, see Q5). |
| Goal | A simple, reliable guided scan: a fixed 3×3 guide in the live preview, YOLO26s colours shown per cell, automatic capture of stable faces, an animated whole-cube rotation arrow between faces, then the existing Phase 2 solve and Phase 1 3D guidance. |
| Out of scope | Retraining, re-benchmarking or re-validating the model; 3D pose estimation; object tracking; ONNX; GPU tuning; mobile; changes to the cube engine, solver or Phase 2 contracts. |

## 1. Intent

The user has trained and evaluated YOLO26s (`backend/weights/best.pt`) and wants it used for what the product promises: point a physical cube at the webcam, face by face, and get a validated cube state without clicking a capture button. Success is a scan that a first-time user can complete by following one square, nine cell colours and one arrow at a time; failure modes (missing, ambiguous or unstable cells; an already-captured face; an illegal cube) explain themselves and recover by rescanning.

**Anti-goals:** synthetic detections in Live mode; inventing or "correcting" a sticker colour; capturing while the cube moves; claiming physical success without a physical test.

## 2. Essential integration checks already done (2026-11-23)

Only what is needed to load and use the checkpoint safely; no accuracy work is planned.

| Check | Result |
| --- | --- |
| File | `backend/weights/best.pt`, 20,323,141 bytes, git-ignored (`backend/weights/*`) |
| SHA-256 | `93b727eca123fb40e1140f0a34cf50cc90cb50fec7eca7dacfb775e61a1a17e0` (identical to `training/exports/yolo26s_rubik_v1/best_final.pt`) |
| Provenance | Stripped export (no optimizer/EMA) of `training/runs/yolo26s_rubik_v1/weights/best.pt` (epoch 43, best fitness 0.749); Ultralytics 8.4.216; trained 2026-11-22 on Colab (torch 2.14.1+cu130, Python 3.13) |
| Loads | Yes, in an isolated scratch venv (Python 3.12.13, torch 2.14.1+cpu, ultralytics 8.4.216) in 0.08 s |
| Task / classes | `detect`; `names = {0: blue, 1: green, 2: orange, 3: red, 4: white, 5: yellow}` (6 classes, alphabetical). The runtime maps **names**, never IDs. |
| Input size | trained at `imgsz=640`; stride 32; 9.95 M parameters |
| Training data notes | Roboflow "rubik-2mkm7" v3 (CC BY 4.0), 2,895 images; **preprocessing stretched every image to 640×640**; augmentations: horizontal flip 0.5, ±15° rotation, small saturation/value jitter, **no hue jitter**, no mosaic |
| Known limitations (from the user's own evaluation artefacts) | Background false positives exist and are mostly labelled **blue** (34 % of background FPs in the normalized test confusion matrix); red↔orange confusion 1–2 %. Both are handled by runtime checks (§5), not by model work. |
| CPU latency (i3-9100F, 4 threads, full test images) | 640 px: median 186 ms (p95 262 ms); 480 px: 107 ms; 320 px: 58 ms |
| Memory | about 590 MB resident with the model loaded and warmed (the solver adds about 1.6 GB → about 2.2 GB backend total) |
| GPU | GTX 1060 3 GB, compute capability 6.1, driver 560.94 (CUDA ≤ 12.6). A `torch 2.14.1+cu126` wheel exists for cp312/Windows; whether it still ships sm_61 kernels is **unverified**. CPU is sufficient for the guided scan (§8), so GPU is deferred (Q6). |

(Side effect of the load check: Ultralytics validation on the test split reproduced the user's recorded mAP50 0.981; it is not part of this phase.)

## 3. Approaches considered

**Associating detections with the nine stickers**

| Approach | Trade-off | Decision |
| --- | --- | --- |
| A. **Fixed square guide + cell assignment.** The user fills a centred square with the face; the frame is cropped to that square; each detection is assigned to the 3×3 cell containing its box centre; per-cell checks decide ok / missing / ambiguous / misaligned. | Deterministic, explainable per cell, cheap, matches the requested UX. Requires the user to align the face (the guide makes that the instruction). | **Selected** |
| B. Full-frame detection + row/column clustering | Tolerates placement, but background false positives (mostly "blue") and other cube faces enter the clustering; harder to explain per cell. | Rejected for now; it is the escalation path (§5.4). |
| C. Lattice/homography fit or 3D pose | Robust to tilt, but more complex and explicitly excluded by the user. | Rejected |

**Where the region of interest is applied**

| Approach | Trade-off | Decision |
| --- | --- | --- |
| A. **Client crops the guide square** from the unmirrored video frame and sends a square JPEG (native guide size, at most 640 px). | Smaller frames, no background outside the guide reaches the model, the model input is square like its stretched-square training data, overlay maths is one affine map. Changes the proposed ARCHITECTURE §8.2 ROI rule (server-side ROI). | **Selected** (Q2) |
| B. Client sends the full frame plus a normalized `roi` in the hello (current §8.2 proposal) | Server crops; boxes in full-frame coordinates; more bytes and background per frame. | Rejected |

## 4. Architecture

```text
Browser (React)                                   Backend (FastAPI, 127.0.0.1:8000)
───────────────                                   ────────────────────────────────
useCamera (unchanged) ─► <video> unmirrored
useLiveScan: every result → crop guide square →    /ws/scan  (app/api/scan_ws.py)
  canvas ≤640² → JPEG ───────── binary frame ───►    decode + limits (app/vision/frames.py)
  (one frame in flight)                              YoloDetector.detect (thread, global lock)
                         ◄────── frame_result ───    grid.analyze → 9 cells + grid + quality
live-scan FSM (pure): stability, capture gate,
  pause + arrow, next stage                       /health: visionReady, modelVersion, device
scan-store.captureFace(face, grid, 'live')
after 6 faces → existing Reconstruction → POST /api/solve (Phase 2) → Phase 1 3D guidance
```

**Ownership (unchanged from ARCHITECTURE §3.1, §6.3):** the backend owns single-frame geometry (cells, grid, quality); the frontend owns scan order, stability, capture and pauses. Demo mode keeps its own scripted source and never opens the socket.

### 4.1 Backend modules (new: `backend/app/vision/`)

| Module | Responsibility |
| --- | --- |
| `vision/detector.py` | `Detection(color, confidence, xyxy)` dataclass; `Detector` protocol `detect(image: np.ndarray) -> list[Detection]`; `ModelUnavailable` error. |
| `vision/yolo_detector.py` | Loads the checkpoint **once** at startup; verifies `task == "detect"` and that the set of class names is exactly the six colours (else `ModelUnavailable` with a precise reason); builds `id → ColorName` from `model.names`; warms up once; `detect` runs `predict(imgsz, conf, device, verbose=False)` and returns name-mapped detections. Records SHA-256 (first 12 hex shown as `modelVersion`). |
| `vision/frames.py` | Decode JPEG bytes with OpenCV; reject > `RUBIK_MAX_FRAME_BYTES` (default 1 MiB), undecodable, non-3-channel, longest edge > `RUBIK_MAX_FRAME_EDGE` (default 1280) or not square within 2 % (the guide crop is square). |
| `vision/grid.py` | Pure: detections + image size → nine `Cell`s, `grid` (nine colours or `None`) and `quality`. No I/O, no model. |
| `api/scan_ws.py` | The `/ws/scan` protocol (§6). |
| `config.py` (extend) | `RUBIK_MODEL_PATH` (default `backend/weights/best.pt` resolved to an **absolute** path from `config.py`'s own location, never from the working directory; a relative env value is resolved against the `backend/` directory; §15 item 1), `RUBIK_CONFIDENCE` (0.5), `RUBIK_IMGSZ` (640), `RUBIK_DEVICE` (`cpu`; `cuda:N` accepted only if `torch.cuda` reports it), `RUBIK_MAX_FRAME_BYTES`, `RUBIK_MAX_FRAME_EDGE`, `RUBIK_ALLOWED_ORIGINS` (default `http://127.0.0.1:5173,http://localhost:5173`). `RUBIK_DETECTOR_MODE` stays `yolo` only. |
| `api/health.py` (extend) | Vision loaded → `status:"ok", visionReady:true, modelVersion:"yolo26s-rubik-v1@93b727eca123", device:"cpu"`. Weights missing/invalid → `status:"degraded", visionReady:false, error:<reason>`; the process still starts and `/api/solve` still works (ARCH §8.1). Solver tables missing still fail startup (Phase 2 rule unchanged). |

**Model lifecycle:** loaded in the FastAPI lifespan after the solver; a missing or invalid checkpoint is reported, not fatal; never downloads a model (Ultralytics offline/settings directory pinned to a backend-local folder); never falls back to COCO weights or a fixture detector. Inference runs via `asyncio.to_thread` under one **global** `asyncio.Lock` (one inference at a time across all connections), so the event loop never blocks.

### 4.2 Frontend modules

| Module | Responsibility |
| --- | --- |
| `types/api.ts` (amend, Q2) | `FrameResult` gains `cells`; adds `ScanHello`, `ScanReady`, `ScanErrorMessage`. |
| `services/parsers.ts` (extend) | Strict `parseFrameResult`, `parseScanServerMessage` (exact keys, known colours, nine cells, finite boxes). |
| `services/scan-transport.ts` (extend) | `ScanTransport` gains `send(frame: Blob): Promise<{ok: true; result: FrameResult} | {ok: false; error: SolveError}>` and `connect()` resolves with the `ready` message; new `WebSocketScanTransport` (hello → ready; one pending frame; timeouts; close/abort). `UnavailableScanTransport` stays for tests and when health is not ready. |
| `lib/scan-roi.ts` (new, pure) | Guide square in frame pixels (centred, side = `0.72 × min(videoW, videoH)`), crop-pixel → frame-pixel → view mapping via the existing `contain-transform.ts`. |
| `features/scanner/live-scan-machine.ts` (new, pure reducer) | Stages F→R→B→L→U→D; stability buffer; capture gate; post-capture pause and arrow; stale-result guard by epoch (§7). |
| `hooks/useLiveScan.ts` (new) | Loop: draw the guide crop from `<video>` to an offscreen canvas at its native side capped at 640 (the camera requests 1280×720, so the guide is about 518 px and is never upscaled) → `toBlob('image/jpeg', 0.85)` → `transport.send` → reducer. One frame in flight; stops on pause, unmount, stage completion, camera stop or rescan. |
| `features/scanner/LiveScanGuide.tsx` (new) | The square guide over the video: 3×3 cells filled with the recognized colour, an outline for missing (dashed) / ambiguous (amber "?") / misaligned (amber) cells, thin detection boxes, a stability ring. |
| `features/scanner/RotationCue.tsx` (new) | Animated arrow and one-line instruction for the whole-cube rotation to the next face (reuses `scan-guide.ts` directions). |
| `LiveViewport.tsx`, `ScanningScreen.tsx`, `LiveUnavailablePanel.tsx` (edit) | Live path renders the guide when readiness is `ready`; the manual "Capture Face" button is removed from Live (auto-capture only); the unavailable panel stays for every non-ready state. Demo components untouched. |

## 5. Grid reconstruction (per frame, backend `vision/grid.py`)

Input: detections on the square crop of side `S` (pixels); cell size `c = S/3`; cell `(r, col)` spans `[col·c, (col+1)·c) × [r·c, (r+1)·c)`; index `3r + col` (row-major, unmirrored, image top = the neighbour named in ARCH §6.2 — so the crop grid **is** the canonical outside-view grid for every stage; no rotation is applied).

1. Keep detections with `confidence ≥ RUBIK_CONFIDENCE` (0.5) and box centre inside the crop.
2. Assign each to the cell containing its centre.
3. Per cell: no box → `missing`. Boxes of one colour only → keep the highest confidence. Boxes of ≥ 2 colours where the runner-up's confidence ≥ 0.6 × the best → `ambiguous` (this is where red/orange flicker shows up); otherwise keep the best.
4. Geometry per kept box: centre within `0.30·c` of the cell centre; width and height within `[0.35·c, 1.10·c]`; aspect ratio within `[0.6, 1.67]`. Fail → `misaligned`.
5. Face-level: largest/smallest kept box area ≤ 2.5 (strong tilt or perspective) else every cell `misaligned` with reason `TILTED`.
6. `grid` = nine colours only if all nine cells are `ok`; otherwise `null`. Never fills or guesses a cell.

`quality.reason` ∈ `NO_FACE` (0 kept cells), `INCOMPLETE` (any missing), `AMBIGUOUS`, `MISALIGNED`, `TILTED`; `quality.valid` true only with a grid. Thresholds are configuration constants, tuned only from the physical gate (§10), never silently at runtime.

### 5.4 When a more robust approach is required (measured at the physical gate)

Escalate to approach B or a lattice fit inside the ROI only if, with a correctly aligned cube under normal indoor light, either (a) more than 10 % of face attempts fail to auto-capture within 10 s, or (b) any capture differs from the physical face. Either result stops the gate and comes back for a design change.

## 6. WebSocket contract `/ws/scan` (schema v1)

| Direction | Message |
| --- | --- |
| C→S text | `{"type":"hello","schemaVersion":1,"scanId":"<uuid>"}` (first message, within 5 s) |
| S→C text | `{"type":"ready","schemaVersion":1,"scanId","modelVersion","imgsz":640,"maxFrameBytes":1048576,"maxFrameEdge":1280}` |
| C→S binary | one square JPEG (the guide crop, side ≤ 640 by the client, ≤ `maxFrameEdge` enforced by the server); the client sends the next only after a result or error |
| S→C text | `{"type":"frame_result","schemaVersion":1,"scanId","frameSeq","width","height","detections":[{"classId","color","confidence","xyxy"}],"cells":[{"color":ColorName\|null,"confidence":number\|null,"status":"ok"\|"missing"\|"ambiguous"\|"misaligned"}×9],"grid":ColorName[9]\|null,"quality":{"valid":bool,"reason"?:string},"inferenceMs"}` |
| S→C text | `{"type":"error","schemaVersion":1,"code":"FRAME_TOO_LARGE"\|"INVALID_FRAME"\|"MODEL_UNAVAILABLE","message","retryable"}` — frame errors keep the socket open; `MODEL_UNAVAILABLE` closes it (code 1011) |

Rules: `frameSeq` starts at 1 per connection; boxes are in crop pixels; a second binary frame while one is processing is a protocol violation → close 1008; a non-hello first message, a bad `schemaVersion` or an unknown origin (`Origin` not in `RUBIK_ALLOWED_ORIGINS`) → close 1008 before any inference; disconnect cancels nothing mid-inference but discards the result; nothing is stored or logged except metadata (frameSeq, reason, inferenceMs). The Vite proxy already forwards `/ws` with `ws: true`.

## 7. Frontend guided-scan behaviour (pure `live-scan-machine.ts`)

States per stage: `aligning → stabilizing → captured(paused) → rotating → aligning(next)`.

- **Stability:** the same nine colours in ≥ 5 consecutive valid results spanning ≥ 1000 ms (ARCH §6.3 defaults). Any invalid result, changed colour or new stage resets it. The guide shows a filling ring.
- **Capture gate** (all must hold): grid valid and stable; the centre colour has not been captured before; stage F centre is **green** and stage U centre is **white** (documented start convention, ARCH §6.1; Q4); stage D centre is the last unseen colour. A failing gate shows a specific hint ("We still see the green face — turn the whole cube left"), never captures.
- **After capture:** send stops (no frames while paused); the captured grid flashes in the guide; `RotationCue` animates the whole-cube move for the next stage for at least 1.5 s; then aligning resumes automatically. No manual capture button.
- **Stale protection:** each send carries the reducer's `epoch` locally; a result for an older epoch (stage changed, rescan, reconnect) is dropped. One frame in flight; new `scanId` on reconnect.
- **Rotation instructions** (ARCH §6.2): F→R, R→B, B→L: "turn the whole cube left"; L→U: "turn back to green, then tilt the top toward you"; U→D: "turn back to green, then tilt the bottom up toward you" (F ends at the image top). The current D wording ("Tilt the bottom … upward") does not say to return to the front first; from the U pose a single tilt would show the green face again (the gate rejects it), so the copy is clarified and its golden test updated (finding F1).
- **After six faces:** the existing Reconstruction screen and `runSolve` → `POST /api/solve` → binding → Alignment → Solving. The camera and socket stop when leaving the scanner (existing `useCamera` lifecycle + transport close).
- **Recovery:** any face card can be re-selected for rescan (existing); a solve failure (`INVALID_CUBE_STATE`, etc.) offers "Scan again" (existing) — the live session restarts at F.

## 8. Performance and resources

| Budget | Target | Basis |
| --- | --- | --- |
| Server inference (CPU, 640 crop) | p95 ≤ 300 ms | measured 186 ms median / 262 ms p95 on full images |
| Effective result rate | ≥ 3 per second | one in flight: inference + JPEG + transport |
| Time to capture an aligned face | ≈ 1.2–2 s | 5 results ≥ 1 s |
| Backend RAM | ≤ 2.5 GB | solver 1.6 GB + model 0.6 GB |
| Frame size | ≤ 1 MiB, ≤ 1280 px edge | 640² JPEG q0.85 ≈ 40–80 KB |

`RUBIK_IMGSZ=480` is the documented lever if CPU latency is too high (107 ms measured), changed only after the physical gate. Scanning and solving never overlap in the UI. GPU (`cu126`) is a separate, optional follow-up after verifying sm_61 support (Q6). ONNX is not part of Phase 3.

## 9. Error handling and recovery

| Situation | Behaviour |
| --- | --- |
| Weights missing / wrong task / wrong class names | `/health` degraded with the reason; Live shows "Vision model is not available — the solver is still usable"; Demo unaffected |
| Socket fails / closes | Live shows a reconnect state with Retry; stability resets; new `scanId` |
| Frame error | Ignored frame, next frame sent; repeated errors (≥ 5 in a row) stop the loop with a message |
| Camera denied / lost | Existing `useCamera` states; loop stops |
| Face misaligned / ambiguous / missing | Per-cell feedback in the guide; no capture |
| Illegal cube after six faces | Existing Phase 2 422 → Reconstruction error → rescan a face or scan again |

## 10. Verification strategy and acceptance criteria

**Automated (every task, test-first):** grid algorithm on synthetic detections (complete, missing, duplicate, conflicting colours, off-centre, oversized, tilted, background boxes); class-name mapping with a permuted `names` dict; model load rejects wrong task/names; frame limits; WebSocket protocol with a detector **test double** (hello/ready, frame_result shape, one in flight, malformed/oversize/non-JPEG, bad origin, disconnect, stale scanId); health with and without weights; a small real-model test on committed sample images (Q3); frontend strict parsers; transport with a fake `WebSocket`; the pure scan machine (stability, gate, pause, rotation, stale epochs, start convention); `useLiveScan` teardown (no frames after unmount/pause, camera tracks stopped); Demo/Live isolation (demo never constructs the socket).

**Browser gate (automated, no real webcam):** Chrome with `--use-file-for-fake-video-capture` playing an MJPEG made locally from sample face images (not committed): Live screen → guide shows nine recognized colours → auto-capture after stabilization → rotation cue → next stage; overlay boxes align with the video (measured offsets); camera tracks end on leaving; console clean apart from the known `THREE.Clock` warning.

**Physical webcam gate (performed by the user with a real cube; the assistant never opens the real webcam):** five full scan sessions under normal indoor light, each followed by the review net comparison against the physical cube:

| Metric | Acceptance |
| --- | --- |
| Faces auto-captured without manual help | 30/30 |
| Wrong captures (captured grid ≠ physical face) | 0 |
| Complete 54/54 reconstructions | ≥ 4 of 5 sessions; any failure must be caught by validation or the review screen, never solved silently |
| Median time per face from end of rotation cue to capture | ≤ 5 s |
| Server inference p95 (from backend logs) | ≤ 300 ms |
| End-to-end: physical cube solved by following the guidance | ≥ 3 different scrambles |

Results go into `docs/superpowers/reports/phase3-verification.md` exactly as observed; anything not performed is NOT RUN.

## 11. Findings, risks and limitations

| # | Item | Handling |
| --- | --- | --- |
| F1 | D-stage copy ambiguity (see §7) | Copy clarified; gate rejects the wrong pose |
| F2 | `training/` is untracked and **not** git-ignored (≈ 800 MB incl. a 394 MB zip, datasets, checkpoints) | Add ignore rules before any commit (Q5); never commit it |
| F3 | Training images were stretched to 640×640 | The square guide crop keeps inference input square |
| F4 | Background false positives, mostly "blue" | Crop to the guide; per-cell geometry; stability |
| F5 | Red/orange confusion | Ambiguity rule + stability + review screen; never auto-corrected |
| R1 | Face roll / wrong rotation path still possible (nine boxes do not prove roll, ARCH §6.2) | Pose instructions, start-convention gate, Phase 2 legality, review screen |
| R2 | Ultralytics is AGPL-3.0; torch CPU adds ≈ 950 MB to the backend environment | Local use only; licence noted in ARCH §11; approval Q1 |
| R3 | Lighting/camera variance beyond the dataset | Measured at the physical gate; thresholds are config |
| R4 | GPU unverified | CPU default; GPU deferred (Q6) |

## 12. Open questions (defaults in bold)

1. **Q1 Dependencies:** add `ultralytics==8.4.216`, `torch==2.14.1` and `torchvision` (CPU wheels from the PyTorch CPU index via uv) to `backend/` — **yes**. Ultralytics is AGPL-3.0.
2. **Q2 Contract:** client-side guide crop (replaces the proposed server-side `roi`) and the additive `cells` array in `FrameResult`, plus `hello`/`ready`/`error` messages; update ARCHITECTURE §8.2 — **yes**.
3. **Q3 Test images:** commit 3–4 small images from the CC BY 4.0 dataset under `fixtures/vision/` with attribution for real-model tests — **yes**; otherwise real-model tests read from `training/` and fail with an instruction when it is absent.
4. **Q4 Start convention enforced:** F must be green and U white (rejected with a clear message otherwise) — **yes**.
5. **Q5 Git hygiene:** ignore `training/datasets/`, `training/runs/`, `training/exports/`, `training/*.zip`; leave `training/notebooks/` untracked for the user — **yes**.
6. **Q6 GPU:** CPU-only in Phase 3; GPU (`cu126`, sm_61 check) as an optional later task — **yes**.

## 13. Builder-check resolutions (author's calls, 2026-11-23)

An independent builder review found no false claim (Vite `/ws` proxy, `FrameResult` shape, `LiveViewport` footer, health stub and the D-stage wording all confirmed). Its open points, settled here:

1. **Rescanning one face** stays allowed (existing face cards). The rotation cue for a rescan starts from the known start pose ("green in front, white on top", then the arrows to that face), and the capture gate requires the rescanned face's centre to equal its previously captured centre (kept when the grid is discarded). "Scan again" after a failed solve restarts at F (existing `restartScan`).
2. **Stage ownership:** `scan-store.captureFace` stays unchanged (it stores the grid and advances `stageIndex`). The pure live machine owns `captured → rotating → aligning` and its own `epoch`, mirrors `stageIndex` after each capture, and `RotationCue` reads the machine. After the sixth capture the machine is `done` and the existing all-captured flow takes over.
3. **Transport result type** is defined in §4.2 and plan Task 6.
4. **Live footer:** it becomes a status strip with no button (connection state, hint, "Face n/6"). The guide is placed in the video's drawn area via `contain-transform` and must not overlap the strip (asserted in the UI test and measured in the browser gate).
5. **Origins:** the origin check covers the dev setup through the Vite proxy (`127.0.0.1:5173`, `localhost:5173`). `vite preview` has no proxy and is not supported for live scanning in Phase 3.
6. **Health and retries:** no automatic polling or reconnect loops. The existing Retry re-checks `/health`; a socket error shows Retry, which reconnects with a new `scanId`.
7. **Stage 6 wording** supersedes ARCHITECTURE §6.2 stage 6's "rotate 180° from the U pose" with the equivalent "return to the front, then tilt the bottom up" (same final pose: D toward the camera, F at the image top). §6.2 is updated in Task 13 and the golden copy test in Task 9.

## 14. Left to the builder

Component styling within the existing theme, exact animation timing above the stated minimums, internal function names, log format.

## 15. Corrections required by the user before implementation (2026-11-23)

1. **Model path independent of the working directory.** The default `RUBIK_MODEL_PATH` is `Path(__file__).resolve().parents[1] / "weights" / "best.pt"` (i.e. `backend/weights/best.pt`), and a relative env value is resolved against `backend/`, never the current directory. Regression tests load settings from a different working directory and assert the same absolute path, for the default and for a relative env value.
2. **Orientation guidance is visual and explicit, never claimed as verified.** The F stage shows a reference-cube diagram of the start pose (green centre toward the camera, white centre on top) before any capture. Every transition shows a reference-cube animation of the whole-cube rotation from the current pose to the next, with U and D drawn as "return to green front, then tilt" sequences. The centre-colour checks (§7) only catch some mistakes: they do not prove whole-cube orientation or face roll, and the UI says "Follow the diagram — the app checks colours, not how you hold the cube". No pose verification is claimed anywhere.
3. **Default tests do not need the model.** Real-checkpoint tests are marked `model` and excluded by default (`addopts = -m 'not slow and not model'`). A fresh checkout without `backend/weights/best.pt` passes the ordinary suite. Ordinary tests use a `Detector` test double or a settings fixture whose model path does not exist (health then reports degraded). The real-model tests run explicitly at the local Phase 3 gate (`uv run pytest -m model`). The Phase 2 solver-table rule is unchanged.
4. **Capture advances only after storage succeeds.** The scan machine moves to `rotating`/next stage only when `onCapture()` returns `true` (the store accepted the grid). On `false` it stays on the same stage, clears the streak, shows "Could not save this face — hold steady to try again", and keeps scanning. A failure-path test pins this.
